import React, { useState, useRef, useEffect, useMemo } from "react";
import * as database from "../../../services/database";
import {
  normalizeScheduleBlock,
  normalizeSceneRef,
  sameScene,
} from "../../../utils/sceneIdentity";
import { buildSceneDisplayLabelMap, getSceneDisplayLabel } from "../../../utils/sceneDisplayLabel";
import { INSERTED_BORDER_COLOR } from "../../../utils/scenePresentation";

// ─── Time utilities ───────────────────────────────────────────────────────────

// "8:30 AM" → minutes since midnight (510). Returns null on bad input.
function parseTimeMins(timeStr) {
  if (!timeStr || timeStr === "END OF DAY") return null;
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === "AM") { if (h === 12) h = 0; }
  else { if (h !== 12) h += 12; }
  return h * 60 + min;
}

// Minutes since midnight → "8:30 AM"
function fmtTimeMins(totalMins) {
  const safe = ((Math.round(totalMins) % 1440) + 1440) % 1440;
  const h24 = Math.floor(safe / 60);
  const min = safe % 60;
  const period = h24 < 12 ? "AM" : "PM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${period}`;
}

// ─── Step constants ───────────────────────────────────────────────────────────
// TIME_GRID_STEP_MINUTES: precision used by time-of-day pickers (start time, call time, lunch start).
// Future actuals will use this same 5-minute grid.
const TIME_GRID_STEP_MINUTES = 5;

// DURATION_STEP_MINUTES: precision used by duration fields (scene duration, lunch duration, wrap duration).
// Kept at 15 minutes; changing this requires updating all duration select dropdowns.
const DURATION_STEP_MINUTES = 15;

// Snap to nearest time-grid boundary (5-minute steps for time-of-day values).
function snapToTimeGrid(mins) {
  return Math.round(mins / TIME_GRID_STEP_MINUTES) * TIME_GRID_STEP_MINUTES;
}

// Snap to nearest duration boundary (15-minute steps for duration values).
// Kept for internal cascade math and duration persistence.
function snap15(mins) {
  return Math.round(mins / DURATION_STEP_MINUTES) * DURATION_STEP_MINUTES;
}

// Parse estimatedDuration string → minutes.
// Handles: "30 min", "1 hr", "1 hr 30 min", "1h30m", "90min", "1/8" page fractions.
function parseDurMins(durStr) {
  if (!durStr) return 30;
  const s = durStr.trim().toLowerCase();
  const hrMin = s.match(/(\d+)\s*hr(?:s?)(?:\s*(\d+)\s*min(?:s?)?)?/);
  if (hrMin) return parseInt(hrMin[1], 10) * 60 + (hrMin[2] ? parseInt(hrMin[2], 10) : 0);
  const minOnly = s.match(/(\d+)\s*min(?:s?)?/);
  if (minOnly) return parseInt(minOnly[1], 10);
  const hm = s.match(/(\d+)h(\d+)m/);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
  const frac = s.match(/^(\d+)\/8$/);
  if (frac) return Math.max(15, parseInt(frac[1], 10) * 15);
  const plain = s.match(/^(\d+)$/);
  if (plain) return parseInt(plain[1], 10);
  return 30;
}

// Format minutes → "1 hr 30 min" / "45 min"
function fmtDurMins(mins) {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h} hr ${rem} min` : `${h} hr`;
}

// All 15-min options for the full 24h day
function buildAllTimeOptions() {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      opts.push(fmtTimeMins(h * 60 + m));
    }
  }
  return opts;
}
const ALL_TIME_OPTS = buildAllTimeOptions();

// ─── Lunch helpers ────────────────────────────────────────────────────────────

const DEFAULT_LUNCH_DUR = 30; // minutes — default when no lunch block / no durationMinutes

// Extract persisted lunch duration from schedule blocks.
// Lunch block stores durationMinutes; falls back to DEFAULT_LUNCH_DUR.
function getLunchDur(scheduleBlocks) {
  const lb = (scheduleBlocks || []).find(b => b.isLunch);
  if (!lb) return DEFAULT_LUNCH_DUR;
  const stored = lb.durationMinutes;
  if (typeof stored === "number" && stored > 0) return stored;
  return DEFAULT_LUNCH_DUR;
}

// Determine whether the lunch block is in manual mode.
// timingMode = "manual" means the user explicitly set the lunch start time.
// Missing or "auto" means lunch follows call time + 6 hours.
function isLunchManual(lunchBlock) {
  return lunchBlock?.timingMode === "manual";
}

// Extract the effective lunch start (minutes) given the lunch block and the day's call time.
// auto:   callMins + 6 hours (call time drives lunch start)
// manual: lunchBlock.time   (user-set, call time change does NOT move lunch)
function getLunchStart(scheduleBlocks, callMins) {
  const lb = (scheduleBlocks || []).find(b => b.isLunch);
  if (lb && isLunchManual(lb)) {
    const parsed = parseTimeMins(lb.time);
    return parsed !== null ? parsed : callMins + 6 * 60;
  }
  // auto or missing: always call + 6h
  return callMins + 6 * 60;
}

// A block is "populated" (counts toward timeline) if it has a scene or customItem.
// Empty placeholder blocks do not advance the cursor.
function isPopulated(block) {
  return Boolean(block.scene || block.customItem);
}

// ─── buildDayTimeline ─────────────────────────────────────────────────────────
// Computes sequential start/end/split info for all scene blocks in a day.
// Pure display function. Only populated scene blocks advance the cursor.
// Lunch duration is read from the lunch block's durationMinutes field.
// Returns array of { block, bStart, bEnd, dur, crossesLunch, postLunchStart, postLunchEnd, lunchMins, lunchDur }.

// buildDayTimeline computes display-only timing for each scene block.
// It reads each block's stored block.time as the authoritative start (matching what the
// Start column shows). lunchMins is derived from the day-level call time (callTimeMinsOverride)
// NOT from the first scene's stored time, so auto lunch = day call time + 6h even when the
// first scene starts later than call time.
function buildDayTimeline(scheduleBlocks, callTimeMinsOverride) {
  const sceneBlocks = (scheduleBlocks || []).filter(b => !b.isEndOfDay && !b.isLunch && !b.isWrap);
  if (!sceneBlocks.length) return [];

  const lunchDur = getLunchDur(scheduleBlocks);
  // lunchCallMins: the day-level call time for auto lunch and split detection.
  // MUST be the actual day call time — never derived from first-scene time.
  // Callers always pass callTimeMinsOverride (from resolveDayCallTimeStr).
  // 8:00 AM fallback only if caller omits it (should not happen in practice).
  const lunchCallMins = callTimeMinsOverride ?? 8 * 60;
  const lunchMins = getLunchStart(scheduleBlocks, lunchCallMins);

  // Each block's bStart = its stored block.time (matches the rendered Start column).
  // Empty blocks display at day call time.
  const firstPopulatedStart = parseTimeMins(sceneBlocks.find(b => isPopulated(b))?.time) ?? lunchCallMins;

  return sceneBlocks.map(b => {
    if (!isPopulated(b)) {
      return { block: b, bStart: firstPopulatedStart, bEnd: firstPopulatedStart, dur: 0, crossesLunch: false, postLunchStart: null, postLunchEnd: null, lunchMins, lunchDur };
    }

    const dur = snap15(Math.max(15, parseDurMins(b.scene?.estimatedDuration)));
    const bStart = parseTimeMins(b.time) ?? firstPopulatedStart;
    const bEnd   = bStart + dur;

    const crossesLunch = bStart < lunchMins && bEnd > lunchMins;
    const postLunchStart = crossesLunch ? lunchMins + lunchDur : null;
    const postLunchEnd   = crossesLunch ? postLunchStart + (bEnd - lunchMins) : null;

    return { block: b, bStart, bEnd, dur, crossesLunch, postLunchStart, postLunchEnd, lunchMins, lunchDur };
  });
}

// ─── recalculateDayScheduleBlocks ────────────────────────────────────────────
// Canonical full-day cascade helper. Returns a new scheduleBlocks array where
// every non-lunch, non-endOfDay populated block has block.time set sequentially.
//
// Options:
//   dayCallMins           — REQUIRED: day-level call time. Used for auto lunch (call+6h) and wrap end.
//                           Must always be the actual day call time, never first-scene time.
//   callTimeMins          — (legacy alias for dayCallMins; both accepted)
//   sceneStartAnchorMins  — explicit scene cascade start (minutes). When provided, the first populated
//                           scene starts at this time. Use this for drag/reorder to preserve the
//                           day's existing Scene Start Anchor regardless of which block is now first.
//                           Distinct from dayCallMins: call time controls lunch/wrap; anchor controls scenes.
//   cascadeFromCallTime   — boolean. When true, cascade cursor starts at dayCallMins so all scenes
//                           are repositioned from call time (e.g. user changed call time).
//                           Overrides sceneStartAnchorMins when true.
//   anchorBlockId / anchorStartMins — if set, that specific block's start is pinned to anchorStartMins
//                           and all following blocks cascade from it (used by SceneTimePopup edits).
//
// Does NOT mutate input. Returns a new array.

function recalculateDayScheduleBlocks(scheduleBlocks, options = {}) {
  const blocks = scheduleBlocks || [];
  if (!blocks.length) return blocks;

  const { dayCallMins: dayCallOverride, callTimeMins: callOverride, cascadeFromCallTime, sceneStartAnchorMins, anchorBlockId, anchorStartMins } = options;

  const endOfDay = blocks.find(b => b.isEndOfDay);
  const lunchBlock = blocks.find(b => b.isLunch);
  const wrapBlock = blocks.find(b => b.isWrap);
  const sceneBlocks = blocks.filter(b => !b.isEndOfDay && !b.isLunch && !b.isWrap);

  const lunchDur = getLunchDur(blocks);

  // dayCallMins: the authoritative day-level call time.
  // Used for: auto lunch start (call + 6h), wrap end (call + 12.5h).
  // NEVER derived from first-scene time. Falls back to 8:00 AM only if omitted.
  const resolvedDayCallOverride = dayCallOverride ?? callOverride;
  const dayCallMins = resolvedDayCallOverride !== undefined
    ? snapToTimeGrid(resolvedDayCallOverride) // time-of-day value
    : 8 * 60;

  // Cascade start: where the cursor begins when cascading scene times.
  // Priority order:
  //   1. cascadeFromCallTime=true → dayCallMins (user explicitly changed call time)
  //   2. sceneStartAnchorMins explicitly provided → use it (drag/reorder preserving anchor)
  //   3. fallback → first populated block's stored time (preserves deliberate gap)
  const firstPopulated = sceneBlocks.find(b => isPopulated(b));
  const cascadeStart = cascadeFromCallTime
    ? dayCallMins
    : sceneStartAnchorMins !== undefined
      ? snapToTimeGrid(sceneStartAnchorMins)
      : (parseTimeMins(firstPopulated?.time ?? sceneBlocks[0]?.time) ?? dayCallMins);

  // lunchCallMins: always the day-level call time — never first-scene time.
  // Lunch start respects timingMode:
  //   auto/missing → dayCallMins + 6h
  //   manual       → lunchBlock.time (user-set)
  const lunchMins = getLunchStart(blocks, dayCallMins);

  // If anchoring a middle block, find its index
  const anchorIdx = anchorBlockId != null
    ? sceneBlocks.findIndex(b => b.id === anchorBlockId)
    : -1;

  const result = [];
  let cursor = cascadeStart;

  sceneBlocks.forEach((b, i) => {
    if (anchorIdx > 0 && i < anchorIdx) {
      // Blocks before anchor keep their original times
      if (isPopulated(b)) {
        const dur = snap15(Math.max(15, parseDurMins(b.scene?.estimatedDuration)));
        const bStart = parseTimeMins(b.time) ?? cursor;
        const bEnd = bStart + dur;
        let effectiveEnd = bEnd;
        if (bStart < lunchMins && bEnd > lunchMins) effectiveEnd = lunchMins + lunchDur + (bEnd - lunchMins);
        cursor = effectiveEnd;
        if (cursor >= lunchMins && cursor < lunchMins + lunchDur) cursor = lunchMins + lunchDur;
      }
      result.push(b); // keep original time
      return;
    }

    // Anchor block: pin cursor to anchorStartMins (time-of-day value)
    if (anchorIdx >= 0 && i === anchorIdx && anchorStartMins !== undefined) {
      cursor = snapToTimeGrid(anchorStartMins);
    }

    if (!isPopulated(b)) {
      // Empty block: show day call time as placeholder (do not advance cursor)
      result.push({ ...b, time: fmtTimeMins(dayCallMins) });
      return;
    }

    const dur = snap15(Math.max(15, parseDurMins(b.scene?.estimatedDuration)));
    const bStart = cursor;
    const bEnd = bStart + dur;
    let effectiveEnd = bEnd;
    if (bStart < lunchMins && bEnd > lunchMins) effectiveEnd = lunchMins + lunchDur + (bEnd - lunchMins);
    cursor = effectiveEnd;
    if (cursor >= lunchMins && cursor < lunchMins + lunchDur) cursor = lunchMins + lunchDur;

    result.push({ ...b, time: fmtTimeMins(bStart) });
  });

  // Reassemble with physical ordering normalization:
  // - populated blocks whose calculated start is < lunchMins go before lunch
  // - populated blocks whose calculated start is >= lunchMins go after lunch
  // - empty placeholder blocks stay appended after all populated blocks (before endOfDay)
  // - endOfDay stays last
  // Always write the computed lunchMins to lunchBlock.time.
  const preLunchPopulated  = [];
  const postLunchPopulated = [];
  const emptyBlocks        = [];

  for (const b of result) {
    if (!isPopulated(b)) {
      emptyBlocks.push(b);
    } else {
      const bStartMins = parseTimeMins(b.time) ?? dayCallMins;
      if (bStartMins < lunchMins) {
        preLunchPopulated.push(b);
      } else {
        postLunchPopulated.push(b);
      }
    }
  }

  const updatedLunchBlock = lunchBlock
    ? { ...lunchBlock, time: fmtTimeMins(lunchMins) }
    : null;

  // Wrap block: always last before endOfDay; end = dayCallMins + 12.5h; start = end - wrapDur
  let updatedWrapBlock = null;
  if (wrapBlock) {
    const wrapDur = typeof wrapBlock.durationMinutes === "number" && wrapBlock.durationMinutes > 0
      ? wrapBlock.durationMinutes : 30;
    const dayEndMins  = dayCallMins + 12.5 * 60; // day-level call time, never first-scene time
    const wrapStart   = snapToTimeGrid(dayEndMins - wrapDur); // time-of-day value
    updatedWrapBlock = { ...wrapBlock, time: fmtTimeMins(wrapStart) };
  }

  const outputBlocks = [
    ...preLunchPopulated,
    ...(updatedLunchBlock ? [updatedLunchBlock] : []),
    ...postLunchPopulated,
    ...emptyBlocks,
    ...(updatedWrapBlock ? [updatedWrapBlock] : []),
    ...(endOfDay ? [endOfDay] : []),
  ];

  return outputBlocks;
}

// ─── Working-time helpers (lunch-aware) ──────────────────────────────────────
// These helpers support the scene popup end-time and duration-from-end math.
// They accept a breaks array: [{ startMins, durationMins }]

// Calculate the wall-clock end time given a start and working duration,
// skipping over any break windows the scene falls into.
function addWorkingDuration(startMins, workingDurMins, breaks) {
  let remaining = workingDurMins;
  let cursor = startMins;
  // Process breaks in chronological order
  const sortedBreaks = (breaks || []).slice().sort((a, b) => a.startMins - b.startMins);
  for (const br of sortedBreaks) {
    if (remaining <= 0) break;
    const brEnd = br.startMins + br.durationMins;
    if (cursor >= brEnd) continue; // break already passed
    if (cursor >= br.startMins) {
      // cursor is inside break — jump to break end
      cursor = brEnd;
      continue;
    }
    // cursor is before break start
    const workBeforeBreak = br.startMins - cursor;
    if (remaining <= workBeforeBreak) {
      cursor += remaining;
      remaining = 0;
      break;
    }
    remaining -= workBeforeBreak;
    cursor = brEnd; // jump over break
  }
  cursor += remaining;
  return snap15(cursor);
}

// Calculate working duration between two wall-clock times,
// subtracting any break time that falls in [startMins, endMins).
function workingDurationBetween(startMins, endMins, breaks) {
  let wallDur = endMins - startMins;
  if (wallDur <= 0) return 0;
  const sortedBreaks = (breaks || []).slice().sort((a, b) => a.startMins - b.startMins);
  for (const br of sortedBreaks) {
    const brEnd = br.startMins + br.durationMins;
    const overlapStart = Math.max(startMins, br.startMins);
    const overlapEnd   = Math.min(endMins, brEnd);
    if (overlapEnd > overlapStart) wallDur -= (overlapEnd - overlapStart);
  }
  return Math.max(0, snap15(wallDur));
}

// ─── TimePicker ───────────────────────────────────────────────────────────────
// Compact 12-row × 4-column (hours × quarters) time picker.
// Rendered inline inside the popup — not a floating overlay.
// Props:
//   valueMins, onChange(mins), onClose, canEdit, label
//   disabledRanges — optional array of { startMins, endMins } (exclusive end) for non-selectable cells.
//     Cells whose time falls within [startMins, endMins) are greyed out and non-clickable.
//     Does not affect AM/PM toggle.

function TimePicker({ valueMins, onChange, onClose, canEdit, label, disabledRanges }) {
  const FF = "'Questrial', 'Futura', 'Arial', sans-serif";
  const h24  = Math.floor(((valueMins % 1440) + 1440) % 1440 / 60);
  const selM = valueMins % 60;
  const selH12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const selPeriod = h24 < 12 ? "AM" : "PM";

  // period is local display state only — does NOT call onChange or onClose.
  // Only cell clicks commit a value and close.
  const [period, setPeriod] = useState(selPeriod);

  // Check if a resolved time (in minutes since midnight) falls in any disabled range.
  const isCellDisabled = (cellMins) => {
    if (!disabledRanges || disabledRanges.length === 0) return false;
    return disabledRanges.some(r => cellMins >= r.startMins && cellMins < r.endMins);
  };

  const handleCell = (h12, m) => {
    if (!canEdit) return;
    let h = h12 % 12;
    if (period === "PM") h += 12;
    const newMins = snapToTimeGrid(h * 60 + m);
    if (isCellDisabled(newMins)) return; // silently ignore — cell is non-working time
    onChange(newMins);
    onClose();
  };

  // AM/PM toggle: only switches the displayed meridiem. Does NOT commit or close.
  const togglePeriod = (p) => {
    if (!canEdit) return;
    setPeriod(p);
  };

  // Two-row layout per hour:
  //   Top row:    :00 :05 :10 :15 :20 :25
  //   Bottom row: :30 :35 :40 :45 :50 :55
  // Hour label spans both rows on the left.
  const MINS_TOP    = [0, 5, 10, 15, 20, 25];
  const MINS_BOTTOM = [30, 35, 40, 45, 50, 55];
  const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  // Grid: 1 hour column (30px) + 6 minute columns
  const GRID_COLS = "30px repeat(6, 1fr)";

  const isSelected = (h12, m) => h12 === selH12 && m === selM && period === selPeriod;

  const minuteCell = (h12, m) => {
    const sel = isSelected(h12, m);
    let h = h12 % 12;
    if (period === "PM") h += 12;
    const cellMins = h * 60 + m;
    const cellDisabled = isCellDisabled(cellMins);
    return (
      <button
        key={m}
        onClick={() => handleCell(h12, m)}
        disabled={!canEdit || cellDisabled}
        title={cellDisabled
          ? `${h12}:${m.toString().padStart(2, "0")} ${period} — lunch break`
          : `${h12}:${m.toString().padStart(2, "0")} ${period}`}
        style={{
          padding: "5px 0", borderRadius: "2px", fontSize: "8px",
          border: sel ? "1.5px solid #1565c0" : "1px solid #ececec",
          backgroundColor: cellDisabled ? "#eeeeee" : sel ? "#1565c0" : "#f8f8f8",
          color: cellDisabled ? "#bbb" : sel ? "white" : "#555",
          cursor: cellDisabled ? "not-allowed" : canEdit ? "pointer" : "default",
          fontFamily: FF,
          fontWeight: sel && !cellDisabled ? "700" : "400",
          textDecoration: cellDisabled ? "line-through" : "none",
          minWidth: 0, overflow: "hidden",
        }}
      >
        {`:${m.toString().padStart(2, "0")}`}
      </button>
    );
  };

  return (
    <div style={{
      border: "1px solid #e0e0e0", borderRadius: "6px", backgroundColor: "white",
      boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: "10px 10px 8px",
      fontFamily: FF, marginTop: "6px",
    }}>
      {label && (
        <div style={{ fontSize: "9px", color: "#888", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      )}

      {/* AM/PM row — click only switches period, does not commit or close */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
        {["AM", "PM"].map(p => (
          <button
            key={p}
            onClick={() => togglePeriod(p)}
            disabled={!canEdit}
            style={{
              flex: 1, padding: "5px 0", borderRadius: "4px", fontSize: "11px",
              fontWeight: "700", cursor: canEdit ? "pointer" : "default",
              border: `1px solid ${period === p ? "#1565c0" : "#ccc"}`,
              backgroundColor: period === p ? "#1565c0" : "white",
              color: period === p ? "white" : "#555", fontFamily: FF,
            }}
          >{p}</button>
        ))}
      </div>

      {/* Two-row hour bands.
          Each band is a CSS grid: hour box (spans 2 grid rows) | 6 top-row cells | 6 bottom-row cells.
          Implemented as a single grid with gridTemplateRows repeating: each 12-cell band = 2 rows. */}
      {HOURS.map(h12 => (
        <div
          key={h12}
          style={{
            display: "grid",
            gridTemplateColumns: GRID_COLS,
            gridTemplateRows: "auto auto",
            gap: "1px",
            marginBottom: "3px",
          }}
        >
          {/* Hour box — spans both rows */}
          <div style={{
            gridRow: "1 / 3",
            fontSize: "11px", fontWeight: "700", fontFamily: FF,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "3px",
            border: "1px solid #e0e0e0",
            backgroundColor: "#f0f0f0",
            color: "#555",
            minHeight: "36px",
          }}>
            {h12}
          </div>
          {/* Top row: :00–:25 */}
          {MINS_TOP.map(m => minuteCell(h12, m))}
          {/* Bottom row: :30–:55 */}
          {MINS_BOTTOM.map(m => minuteCell(h12, m))}
        </div>
      ))}
    </div>
  );
}


// ─── SceneTimePopup ──────────────────────────────────────────────────────────
// Selected-scene Start / End / Duration editor.
// End-time shown is wall-clock end (accounts for lunch crossing).
// Duration is working time only (lunch excluded when crossing).
// Shows SPLIT badge when drafted scene crosses the lunch break.
// Props:
//   anchorRect    — DOMRect of the trigger button
//   popupData     — { dayId, blockId, block, day, callTimeMins }
//   onCommit({ dayId, blockId, newTimeStr, newDurStr, sceneRef, newDayBlocks, newCallTimeStr })
//   onClose()
//   displayLabelMap, canEdit

function SceneTimePopup({ anchorRect, popupData, onCommit, onClose, displayLabelMap, canEdit }) {
  const { day } = popupData;
  const popupRef = useRef(null);
  const FF = "'Questrial', 'Futura', 'Arial', sans-serif";

  const editBlock = (day.scheduleBlocks || []).find(b => b.id === popupData.blockId) ?? popupData.block;

  // Derive lunch break parameters using the same helpers as buildDayTimeline / recalculate.
  // callMins is taken from popupData.callTimeMins (passed by the module) so auto lunch
  // uses the authoritative day-level call time, not the first populated block's stored time.
  const lunchDur  = getLunchDur(day.scheduleBlocks);
  const callMins  = popupData.callTimeMins ?? (parseTimeMins(
    (day.scheduleBlocks || []).find(b => !b.isEndOfDay && !b.isLunch && isPopulated(b))?.time
  ) ?? 8 * 60);
  const lunchMins = getLunchStart(day.scheduleBlocks, callMins);
  const breaks    = [{ startMins: lunchMins, durationMins: lunchDur }];

  // initStartMins: snapped to time-grid precision (5-min) — time-of-day value
  const initStartMins = snapToTimeGrid(parseTimeMins(editBlock.time) ?? 8 * 60);
  // initDurMins: snapped to duration precision (15-min) — working duration value
  const initDurMins   = snap15(Math.max(DURATION_STEP_MINUTES, parseDurMins(editBlock.scene?.estimatedDuration)));

  const [startMins, setStartMins] = useState(initStartMins);
  const [durMins,   setDurMins]   = useState(initDurMins);
  const [lastEdited, setLastEdited] = useState("dur"); // "end" | "dur"
  const [pickerFor, setPickerFor]   = useState(null);  // "start" | "end" | null

  // Wall-clock end: time-of-day value, snapped to time-grid precision
  const endMins = snapToTimeGrid(addWorkingDuration(startMins, durMins, breaks));
  const crossesLunch = startMins < lunchMins && endMins > lunchMins;

  const applyStart = (mins) => {
    const s = snapToTimeGrid(mins);
    if (lastEdited === "end") {
      // Preserve wall-clock end; recalculate working duration (duration stays 15-min snapped)
      setDurMins(snap15(Math.max(DURATION_STEP_MINUTES, workingDurationBetween(s, endMins, breaks))));
    }
    setStartMins(s);
    setPickerFor(null);
  };

  const applyEnd = (mins) => {
    const e = snapToTimeGrid(mins);
    // Working duration = wall time minus any break overlap (duration stays 15-min snapped)
    setDurMins(snap15(Math.max(DURATION_STEP_MINUTES, workingDurationBetween(startMins, e, breaks))));
    setLastEdited("end");
    setPickerFor(null);
  };

  const applyDur = (h, m) => {
    setDurMins(snap15(Math.max(DURATION_STEP_MINUTES, h * 60 + m)));
    setLastEdited("dur");
  };

  // ── Positioning: popup right edge aligns to left edge of the clicked Start button ──
  const POPUP_W = 340;
  const [pos, setPos] = useState(null); // null = not yet positioned → renders hidden

  useEffect(() => {
    if (!anchorRect || !popupRef.current) return;
    const popupH = popupRef.current.offsetHeight || 400;
    const vh = window.innerHeight;
    // Place popup fully to the left: popup right edge = anchorRect.left (button left edge)
    let left = anchorRect.left - POPUP_W;
    if (left < 8) left = 8;
    if (left + POPUP_W > window.innerWidth - 8) left = window.innerWidth - POPUP_W - 8;
    let top = anchorRect.bottom + 4;
    if (top + popupH > vh - 8) {
      const aboveTop = anchorRect.top - popupH - 4;
      top = aboveTop >= 8 ? aboveTop : Math.max(8, vh - popupH - 8);
    }
    setPos({ top, left });
  }, [anchorRect?.top, anchorRect?.bottom, anchorRect?.left, pickerFor]);

  useEffect(() => {
    const handleDown = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (pickerFor) { setPickerFor(null); return; }
        onClose();
      }
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, pickerFor]);

  // ── Conflict detection (reactive, derived from current startMins) ────────────
  const prevPopulatedBlock = (() => {
    const nonSpecial = (day.scheduleBlocks || []).filter(b => !b.isEndOfDay && !b.isLunch && !b.isWrap);
    const idx = nonSpecial.findIndex(b => b.id === popupData.blockId);
    for (let i = idx - 1; i >= 0; i--) {
      if (isPopulated(nonSpecial[i])) return nonSpecial[i];
    }
    return null;
  })();

  const conflictInfo = (() => {
    if (!prevPopulatedBlock) return null;
    const prevStartMins = parseTimeMins(prevPopulatedBlock.time) ?? callMins;
    const prevWorkDur   = snap15(Math.max(15, parseDurMins(prevPopulatedBlock.scene?.estimatedDuration)));
    const prevTrueEnd   = addWorkingDuration(prevStartMins, prevWorkDur, breaks);
    if (startMins < prevTrueEnd) {
      const prevNewDurMins = snap15(Math.max(15, workingDurationBetween(prevStartMins, startMins, breaks)));
      return { prevBlock: prevPopulatedBlock, prevOldDurMins: prevWorkDur, prevNewDurMins, prevTrueEnd };
    }
    return null;
  })();

  // ── Commit ────────────────────────────────────────────────────────────────
  const commitSceneAndClose = () => {
    const newTimeStr = fmtTimeMins(startMins);
    const durChanged = durMins !== initDurMins;
    const newDurStr  = durChanged ? fmtDurMins(durMins) : null;

    // If conflict: also shorten the previous scene's duration inline
    let provisionalBlocks = (day.scheduleBlocks || []).map(b => {
      if (b.id !== popupData.blockId) return b;
      const updated = { ...b };
      if (newDurStr && b.scene) updated.scene = { ...b.scene, estimatedDuration: newDurStr };
      return updated;
    });

    if (conflictInfo) {
      const shortenedDurStr = fmtDurMins(conflictInfo.prevNewDurMins);
      provisionalBlocks = provisionalBlocks.map(b => {
        if (b.id !== conflictInfo.prevBlock.id) return b;
        return b.scene ? { ...b, scene: { ...b.scene, estimatedDuration: shortenedDurStr } } : b;
      });
    }

    const newDayBlocks = recalculateDayScheduleBlocks(provisionalBlocks, {
      dayCallMins: callMins,   // day-level call time — never first-scene time
      anchorBlockId: popupData.blockId,
      anchorStartMins: startMins,
    });

    onCommit({
      dayId: popupData.dayId,
      blockId: popupData.blockId,
      newTimeStr,
      newDurStr,
      sceneRef: editBlock.scene,
      newDayBlocks,
      newCallTimeStr: null,
      // If conflict, pass the shortened prev scene so module can persist its duration
      prevSceneRef: conflictInfo?.prevBlock?.scene ?? null,
      prevSceneNewDurStr: conflictInfo ? fmtDurMins(conflictInfo.prevNewDurMins) : null,
    });
    onClose();
  };

  // ── Style tokens ──────────────────────────────────────────────────────────
  const fieldLabel   = { fontSize: "10px", color: "#888", marginBottom: "3px", display: "block", fontFamily: FF };
  const primaryBtn   = { padding: "7px 16px", border: "none", borderRadius: "4px", backgroundColor: "#1565c0", color: "white", fontSize: "11px", fontWeight: "700", cursor: "pointer", fontFamily: FF };
  const cancelBtn    = { padding: "7px 14px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "white", color: "#555", fontSize: "11px", cursor: "pointer", fontFamily: FF };
  const timeFieldBtn = (active) => ({
    width: "100%", padding: "5px 8px", border: `1px solid ${active ? "#1565c0" : "#ccc"}`,
    borderRadius: "4px", backgroundColor: active ? "#e3f2fd" : "white",
    color: active ? "#1565c0" : "#333", fontSize: "12px", fontWeight: active ? "700" : "400",
    cursor: canEdit ? "pointer" : "default", textAlign: "left", fontFamily: FF,
  });

  const computedMaxH = pos ? `calc(100vh - ${pos.top + 12}px)` : "90vh";

  return (
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        top: pos ? pos.top : 0, left: pos ? pos.left : 0,
        width: POPUP_W,
        backgroundColor: "white",
        border: "1px solid #ccc",
        borderRadius: "6px",
        boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
        zIndex: 99999,
        fontFamily: FF,
        maxHeight: computedMaxH,
        overflowY: "auto",
        scrollbarGutter: "stable",
        visibility: pos ? "visible" : "hidden",
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ padding: "14px 16px" }}>
        {/* Scene identity chip */}
        {editBlock.scene && (
          <div style={{ marginBottom: "12px", padding: "7px 9px", backgroundColor: "#f0f4ff", borderRadius: "4px", fontSize: "11px", color: "#333", fontFamily: FF }}>
            <strong>Scene {getSceneDisplayLabel(editBlock.scene, displayLabelMap)}:</strong>{" "}
            {editBlock.scene.metadata?.intExt} – {editBlock.scene.metadata?.location}
            <span style={{ marginLeft: "8px", color: "#888" }}>{editBlock.scene.estimatedDuration}</span>
          </div>
        )}
        {editBlock.isLunch && (
          <div style={{ marginBottom: "12px", padding: "7px 9px", backgroundColor: "#757575", borderRadius: "4px", fontSize: "11px", color: "white", fontFamily: FF }}>
            <strong>LUNCH BREAK</strong>
          </div>
        )}

        {/* SPLIT badge — shown when drafted scene crosses lunch */}
        {crossesLunch && (
          <div style={{
            marginBottom: "10px", padding: "5px 9px",
            backgroundColor: "#fff9e6", border: "1px solid #f9a825",
            borderRadius: "4px", display: "flex", alignItems: "center", gap: "8px",
          }}>
            <span style={{ fontSize: "9px", fontWeight: "700", color: "#e65100", backgroundColor: "#fff3e0", border: "1px solid #ffcc02", padding: "1px 6px", borderRadius: "3px", fontFamily: FF }}>
              SPLIT
            </span>
            <span style={{ fontSize: "10px", color: "#795548", fontFamily: FF }}>
              Scene continues after lunch ({fmtDurMins(lunchDur)} break)
            </span>
          </div>
        )}

        {/* Start / End time fields */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <div style={{ flex: 1 }}>
            <span style={fieldLabel}>Start Time</span>
            <button style={timeFieldBtn(pickerFor === "start")} onClick={() => canEdit && setPickerFor(pickerFor === "start" ? null : "start")}>
              {fmtTimeMins(startMins)}
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <span style={fieldLabel}>End Time {crossesLunch ? "(incl. lunch)" : ""}</span>
            <button style={timeFieldBtn(pickerFor === "end")} onClick={() => canEdit && setPickerFor(pickerFor === "end" ? null : "end")}>
              {fmtTimeMins(endMins)}
            </button>
          </div>
        </div>

        {pickerFor === "start" && (
          <TimePicker
            label="Select Start Time"
            valueMins={startMins}
            onChange={applyStart}
            onClose={() => setPickerFor(null)}
            canEdit={canEdit}
            disabledRanges={[{ startMins: lunchMins, endMins: lunchMins + lunchDur }]}
          />
        )}
        {pickerFor === "end" && (
          <TimePicker
            label="Select End Time"
            valueMins={endMins}
            onChange={applyEnd}
            onClose={() => setPickerFor(null)}
            canEdit={canEdit}
          />
        )}

        {!pickerFor && (
          <>
            <div style={{ marginBottom: "12px" }}>
              <span style={fieldLabel}>Scene Duration (working time, 15-min steps)</span>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <select value={Math.floor(durMins / 60)} onChange={e => applyDur(parseInt(e.target.value, 10), durMins % 60)} disabled={!canEdit}
                  style={{ padding: "5px 4px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: FF, flex: "0 0 auto" }}>
                  {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
                <select value={durMins % 60} onChange={e => applyDur(Math.floor(durMins / 60), parseInt(e.target.value, 10))} disabled={!canEdit}
                  style={{ padding: "5px 4px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: FF, flex: "0 0 auto" }}>
                  {[0,15,30,45].map(m => <option key={m} value={m}>{m.toString().padStart(2,"0")}m</option>)}
                </select>
                <span style={{ fontSize: "11px", color: "#888", fontFamily: FF, flex: 1 }}>{fmtDurMins(durMins)}</span>
              </div>
              {durMins !== initDurMins && (
                <div style={{ fontSize: "9px", color: "#1565c0", marginTop: "3px", fontFamily: FF }}>Duration changed — will be saved on Set Time.</div>
              )}
            </div>

            {/* Inline conflict warning */}
            {conflictInfo && (
              <div style={{
                marginBottom: "10px", padding: "8px 10px",
                backgroundColor: "#fdecea", border: "1px solid #e57373",
                borderRadius: "4px", fontSize: "11px", color: "#b71c1c", fontFamily: FF,
                lineHeight: 1.5,
              }}>
                <strong>Schedule conflict:</strong> Starting at {fmtTimeMins(startMins)} overlaps the previous scene, which ends at {fmtTimeMins(conflictInfo.prevTrueEnd)}.
                <div style={{ marginTop: "3px", fontSize: "10px", color: "#c62828" }}>
                  Previous scene will be shortened from <strong>{fmtDurMins(conflictInfo.prevOldDurMins)}</strong> to <strong>{fmtDurMins(conflictInfo.prevNewDurMins)}</strong>.
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", paddingTop: "6px", borderTop: "1px solid #f0f0f0" }}>
              <button style={cancelBtn} onClick={onClose}>Cancel</button>
              {canEdit && (
                <button
                  style={{ ...primaryBtn, backgroundColor: conflictInfo ? "#c62828" : "#1565c0" }}
                  onClick={commitSceneAndClose}
                >
                  {conflictInfo ? "Shorten Previous & Set Time" : "Set Time"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CallTimePopup ────────────────────────────────────────────────────────────
// Standalone call-time editor rendered at module level (position:fixed) so it
// escapes any overflow:hidden ancestor.
// Props:
//   anchorRect  — DOMRect of the trigger button in the day header
//   dayId       — shooting day ID
//   currentCallMins — current call time in minutes
//   onCommit(dayId, newCallMins) — caller runs cascade + persist + callSheet sync
//   onClose()
//   canEdit

function CallTimePopup({ anchorRect, dayId, currentCallMins, onCommit, onClose, canEdit }) {
  const popupRef = useRef(null);
  const FF = "'Questrial', 'Futura', 'Arial', sans-serif";
  const POPUP_W = 220;
  const [pos, setPos] = useState(null); // null = not yet positioned → renders hidden
  const lunchPreview = fmtTimeMins(currentCallMins + 6 * 60);

  useEffect(() => {
    if (!anchorRect || !popupRef.current) return;
    const popupH = popupRef.current.offsetHeight || 320;
    const vh = window.innerHeight;
    // Open below anchor, right-edge-aligned to button right
    let left = anchorRect.right - POPUP_W;
    if (left < 8) left = 8;
    if (left + POPUP_W > window.innerWidth - 8) left = window.innerWidth - POPUP_W - 8;
    let top = anchorRect.bottom + 4;
    if (top + popupH > vh - 8) {
      const aboveTop = anchorRect.top - popupH - 4;
      top = aboveTop >= 8 ? aboveTop : Math.max(8, vh - popupH - 8);
    }
    setPos({ top, left });
  }, [anchorRect?.top, anchorRect?.bottom, anchorRect?.right]);

  useEffect(() => {
    const handleDown = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const handleSelect = (newMins) => {
    onCommit(dayId, newMins);
    onClose();
  };

  return (
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        top: pos ? pos.top : 0, left: pos ? pos.left : 0,
        width: POPUP_W,
        backgroundColor: "white",
        border: "1px solid #ccc",
        borderRadius: "6px",
        boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
        zIndex: 99999,
        fontFamily: FF,
        padding: "10px 12px",
        maxHeight: pos ? `calc(100vh - ${pos.top + 12}px)` : "90vh",
        overflowY: "auto",
        scrollbarGutter: "stable",
        visibility: pos ? "visible" : "hidden",
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ fontSize: "10px", fontWeight: "700", color: "#555", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: FF }}>
        Call Time
      </div>
      <div style={{ fontSize: "9px", color: "#aaa", marginBottom: "8px", fontFamily: FF }}>
        Lunch auto: {lunchPreview} (call + 6 h)
      </div>
      <TimePicker
        label={null}
        valueMins={currentCallMins}
        onChange={handleSelect}
        onClose={onClose}
        canEdit={canEdit}
      />
    </div>
  );
}

// ─── LunchTimePopup ───────────────────────────────────────────────────────────
// Editable lunch start + duration popup. Persists durationMinutes and timingMode
// inside the lunch schedule block (JSONB) — no schema change needed.
// Props:
//   anchorRect      — DOMRect of the lunch time button
//   dayId           — shooting day ID
//   lunchBlock      — the lunch schedule block object
//   callTimeMins    — day call time in minutes (used to compute auto start display)
//   onCommit({ dayId, newLunchStartStr, newDurationMins, newTimingMode })
//   onClose()
//   canEdit

function LunchTimePopup({ anchorRect, dayId, lunchBlock, callTimeMins, onCommit, onClose, canEdit }) {
  const popupRef = useRef(null);
  const FF = "'Questrial', 'Futura', 'Arial', sans-serif";
  const POPUP_W = 310;
  const [pos, setPos] = useState(null); // null = not yet positioned → renders hidden

  // autoStartMins: time-of-day value, snapped to time-grid precision
  const autoStartMins = snapToTimeGrid((callTimeMins ?? 8 * 60) + 6 * 60);
  const initIsManual = isLunchManual(lunchBlock);
  // initDurMins: duration value, kept at 15-min precision
  const initDurMins = typeof lunchBlock?.durationMinutes === "number" && lunchBlock.durationMinutes > 0
    ? lunchBlock.durationMinutes
    : DEFAULT_LUNCH_DUR;

  const [mode, setMode] = useState(initIsManual ? "manual" : "auto");
  const initManualStart = initIsManual
    ? snapToTimeGrid(parseTimeMins(lunchBlock?.time) ?? autoStartMins)
    : autoStartMins;
  const [manualStartMins, setManualStartMins] = useState(initManualStart);
  const [durMins, setDurMins] = useState(initDurMins);
  const [pickerFor, setPickerFor] = useState(null); // "start" | null

  const startMins = mode === "auto" ? autoStartMins : manualStartMins;
  const endMins = startMins + durMins; // wall-clock end, no additional snapping needed here

  const switchToAuto = () => {
    setMode("auto");
    setPickerFor(null);
  };
  const switchToManual = () => {
    // When switching to manual, seed the manual start from the current auto value if not already set
    if (mode === "auto") setManualStartMins(autoStartMins);
    setMode("manual");
  };

  useEffect(() => {
    if (!anchorRect || !popupRef.current) return;
    const popupH = popupRef.current.offsetHeight || 320;
    const vh = window.innerHeight;
    // Matches SceneTimePopup/WrapPopup: popup right edge = left edge of clicked button
    let left = anchorRect.left - POPUP_W;
    if (left < 8) left = 8;
    if (left + POPUP_W > window.innerWidth - 8) left = window.innerWidth - POPUP_W - 8;
    let top = anchorRect.bottom + 4;
    if (top + popupH > vh - 8) {
      const aboveTop = anchorRect.top - popupH - 4;
      top = aboveTop >= 8 ? aboveTop : Math.max(8, vh - popupH - 8);
    }
    setPos({ top, left });
  }, [anchorRect?.top, anchorRect?.bottom, anchorRect?.left, pickerFor]);

  useEffect(() => {
    const handleDown = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (pickerFor) { setPickerFor(null); return; }
        onClose();
      }
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, pickerFor]);

  const commitAndClose = () => {
    onCommit({ dayId, newLunchStartStr: fmtTimeMins(startMins), newDurationMins: durMins, newTimingMode: mode });
    onClose();
  };

  const fieldLabel   = { fontSize: "10px", color: "#888", marginBottom: "3px", display: "block", fontFamily: FF };
  const primaryBtn   = { padding: "7px 16px", border: "none", borderRadius: "4px", backgroundColor: "#1565c0", color: "white", fontSize: "11px", fontWeight: "700", cursor: "pointer", fontFamily: FF };
  const cancelBtn    = { padding: "7px 14px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "white", color: "#555", fontSize: "11px", cursor: "pointer", fontFamily: FF };
  const timeFieldBtn = (active) => ({
    width: "100%", padding: "5px 8px", border: `1px solid ${active ? "#1565c0" : "#ccc"}`,
    borderRadius: "4px", backgroundColor: active ? "#e3f2fd" : "white",
    color: active ? "#1565c0" : "#333", fontSize: "12px", fontWeight: active ? "700" : "400",
    cursor: canEdit ? "pointer" : "default", textAlign: "left", fontFamily: FF,
  });

  return (
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        top: pos ? pos.top : 0, left: pos ? pos.left : 0,
        width: POPUP_W,
        backgroundColor: "white",
        border: "1px solid #ccc",
        borderRadius: "6px",
        boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
        zIndex: 99999,
        fontFamily: FF,
        maxHeight: pos ? `calc(100vh - ${pos.top + 12}px)` : "90vh",
        overflowY: "auto",
        scrollbarGutter: "stable",
        visibility: pos ? "visible" : "hidden",
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ padding: "14px 16px" }}>
        {/* Header */}
        <div style={{
          marginBottom: "10px", padding: "7px 9px", backgroundColor: "#757575",
          borderRadius: "4px", fontSize: "11px", color: "white", fontFamily: FF,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <strong>LUNCH BREAK</strong>
        </div>

        {/* Auto / Manual toggle */}
        <div style={{ marginBottom: "12px" }}>
          <span style={fieldLabel}>Lunch Timing Mode</span>
          <div style={{ display: "flex", gap: "6px" }}>
            {["auto", "manual"].map(m => (
              <button
                key={m}
                onClick={() => canEdit && (m === "auto" ? switchToAuto() : switchToManual())}
                disabled={!canEdit}
                style={{
                  flex: 1, padding: "5px 0", borderRadius: "4px", fontSize: "11px",
                  fontWeight: "700", cursor: canEdit ? "pointer" : "default",
                  border: `1px solid ${mode === m ? "#1565c0" : "#ccc"}`,
                  backgroundColor: mode === m ? "#1565c0" : "white",
                  color: mode === m ? "white" : "#555", fontFamily: FF,
                }}
              >
                {m === "auto" ? "Auto (call + 6 h)" : "Manual"}
              </button>
            ))}
          </div>
          {mode === "auto" && (
            <div style={{ fontSize: "9px", color: "#888", marginTop: "4px", fontFamily: FF }}>
              Lunch start moves with call time.
            </div>
          )}
        </div>

        {/* Lunch Start */}
        <div style={{ marginBottom: "10px" }}>
          <span style={fieldLabel}>Lunch Start{mode === "auto" ? " (auto)" : ""}</span>
          <button
            style={timeFieldBtn(pickerFor === "start")}
            onClick={() => canEdit && mode === "manual" && setPickerFor(pickerFor === "start" ? null : "start")}
            disabled={!canEdit || mode === "auto"}
            title={mode === "auto" ? "Switch to Manual to set lunch start" : ""}
          >
            {fmtTimeMins(startMins)}
          </button>
        </div>
        {pickerFor === "start" && mode === "manual" && (
          <TimePicker label="Select Lunch Start" valueMins={manualStartMins}
            onChange={(m) => { setManualStartMins(snapToTimeGrid(m)); setPickerFor(null); }}
            onClose={() => setPickerFor(null)} canEdit={canEdit} />
        )}

        {!pickerFor && (
          <>
            {/* Lunch Duration */}
            <div style={{ marginBottom: "12px" }}>
              <span style={fieldLabel}>Lunch Duration (15-min steps)</span>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <select
                  value={Math.floor(durMins / 60)}
                  onChange={e => setDurMins(snap15(Math.max(15, parseInt(e.target.value, 10) * 60 + (durMins % 60))))}
                  disabled={!canEdit}
                  style={{ padding: "5px 4px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: FF, flex: "0 0 auto" }}
                >
                  {[0,1,2].map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
                <select
                  value={durMins % 60}
                  onChange={e => setDurMins(snap15(Math.max(15, Math.floor(durMins / 60) * 60 + parseInt(e.target.value, 10))))}
                  disabled={!canEdit}
                  style={{ padding: "5px 4px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: FF, flex: "0 0 auto" }}
                >
                  {[0,15,30,45].map(m => <option key={m} value={m}>{m.toString().padStart(2,"0")}m</option>)}
                </select>
                <span style={{ fontSize: "11px", color: "#888", fontFamily: FF, flex: 1 }}>{fmtDurMins(durMins)}</span>
              </div>
            </div>

            {/* Lunch End preview */}
            <div style={{ marginBottom: "12px", padding: "5px 8px", backgroundColor: "#f5f5f5", borderRadius: "4px", fontSize: "11px", color: "#555", fontFamily: FF }}>
              Lunch ends: <strong>{fmtTimeMins(endMins)}</strong>
              {durMins !== initDurMins && (
                <span style={{ marginLeft: "8px", fontSize: "9px", color: "#1565c0" }}>Duration changed</span>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", paddingTop: "6px", borderTop: "1px solid #f0f0f0" }}>
              <button style={cancelBtn} onClick={onClose}>Cancel</button>
              {canEdit && <button style={primaryBtn} onClick={commitAndClose}>Save Lunch</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── WrapPopup ────────────────────────────────────────────────────────────────
// Compact popup to edit the Wrap block duration.
// Wrap end = call time + 12.5h; wrap start = wrap end - duration.
// Props: anchorRect, dayId, wrapBlock, callTimeMins, onCommit({ dayId, newDurationMins }), onClose, canEdit

function WrapPopup({ anchorRect, dayId, wrapBlock, callTimeMins, onCommit, onClose, canEdit }) {
  const popupRef = useRef(null);
  const FF = "'Questrial', 'Futura', 'Arial', sans-serif";
  const POPUP_W = 260;
  const [pos, setPos] = useState(null); // null = not yet positioned → renders hidden

  const initDurMins = typeof wrapBlock?.durationMinutes === "number" && wrapBlock.durationMinutes > 0
    ? wrapBlock.durationMinutes : 30;
  const [durMins, setDurMins] = useState(initDurMins);

  const dayEndMins  = (callTimeMins ?? 8 * 60) + 12.5 * 60;
  const wrapStart   = snapToTimeGrid(dayEndMins - durMins); // time-of-day value
  const wrapEnd     = dayEndMins;

  useEffect(() => {
    if (!anchorRect || !popupRef.current) return;
    const popupH = popupRef.current.offsetHeight || 200;
    const vh = window.innerHeight;
    let left = anchorRect.left - POPUP_W;
    if (left < 8) left = 8;
    if (left + POPUP_W > window.innerWidth - 8) left = window.innerWidth - POPUP_W - 8;
    let top = anchorRect.bottom + 4;
    if (top + popupH > vh - 8) {
      const aboveTop = anchorRect.top - popupH - 4;
      top = aboveTop >= 8 ? aboveTop : Math.max(8, vh - popupH - 8);
    }
    setPos({ top, left });
  }, [anchorRect?.top, anchorRect?.bottom, anchorRect?.left]);

  useEffect(() => {
    const handleDown = (e) => { if (popupRef.current && !popupRef.current.contains(e.target)) onClose(); };
    const handleKey  = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleDown); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  const fieldLabel = { fontSize: "10px", color: "#888", marginBottom: "3px", display: "block", fontFamily: FF };
  const primaryBtn = { padding: "7px 16px", border: "none", borderRadius: "4px", backgroundColor: "#263238", color: "white", fontSize: "11px", fontWeight: "700", cursor: "pointer", fontFamily: FF };
  const cancelBtn  = { padding: "7px 14px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "white", color: "#555", fontSize: "11px", cursor: "pointer", fontFamily: FF };

  return (
    <div ref={popupRef} style={{
      position: "fixed", top: pos ? pos.top : 0, left: pos ? pos.left : 0, width: POPUP_W,
      backgroundColor: "white", border: "1px solid #ccc", borderRadius: "6px",
      boxShadow: "0 8px 28px rgba(0,0,0,0.18)", zIndex: 99999, fontFamily: FF,
      maxHeight: pos ? `calc(100vh - ${pos.top + 12}px)` : "90vh", overflowY: "auto",
      visibility: pos ? "visible" : "hidden",
    }} onMouseDown={e => e.stopPropagation()}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ marginBottom: "12px", padding: "7px 9px", backgroundColor: "#263238", borderRadius: "4px", fontSize: "11px", color: "white", fontFamily: FF }}>
          <strong>WRAP</strong>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <span style={fieldLabel}>Wrap Duration (15-min steps)</span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <select value={Math.floor(durMins / 60)} onChange={e => setDurMins(snap15(Math.max(15, parseInt(e.target.value, 10) * 60 + (durMins % 60))))} disabled={!canEdit}
              style={{ padding: "5px 4px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: FF, flex: "0 0 auto" }}>
              {[0,1,2].map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
            <select value={durMins % 60} onChange={e => setDurMins(snap15(Math.max(15, Math.floor(durMins / 60) * 60 + parseInt(e.target.value, 10))))} disabled={!canEdit}
              style={{ padding: "5px 4px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: FF, flex: "0 0 auto" }}>
              {[0,15,30,45].map(m => <option key={m} value={m}>{m.toString().padStart(2,"0")}m</option>)}
            </select>
            <span style={{ fontSize: "11px", color: "#888", fontFamily: FF, flex: 1 }}>{fmtDurMins(durMins)}</span>
          </div>
        </div>

        <div style={{ marginBottom: "12px", padding: "5px 8px", backgroundColor: "#f5f5f5", borderRadius: "4px", fontSize: "11px", color: "#555", fontFamily: FF }}>
          <div>Wrap Start: <strong>{fmtTimeMins(wrapStart)}</strong></div>
          <div>Wrap End: <strong>{fmtTimeMins(wrapEnd)}</strong></div>
        </div>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", paddingTop: "6px", borderTop: "1px solid #f0f0f0" }}>
          <button style={cancelBtn} onClick={onClose}>Cancel</button>
          {canEdit && <button style={primaryBtn} onClick={() => { onCommit({ dayId, newDurationMins: durMins }); onClose(); }}>Save Wrap</button>}
        </div>
      </div>
    </div>
  );
}

function DayBlock({
  day,
  timeOptions,
  onDrop,
  handleDragOver,
  handleDragStart,
  handleDragEnd,
  removeScene,
  removeBlock,
  addBlock,
  updateShootingDayDate,
  removeShootingDay,
  updateBlockTime,
  updateCustomItem,
  lockDayAndMarkShot,
  unlockDay,
  getSceneBlockColor,
  getSceneBlockTextColor,
  displayLabelMap,
  updateDayCollapse,
  handleSceneDoubleClick,
  syncShootingDays,
  dropIndicator,
  canEdit,
  onOpenTimePopup,
  activePopupBlockId,
  dayTimeline,         // pre-computed by StripboardScheduleModule, array from buildDayTimeline
  onOpenCallTimePopup, // (dayId, DOMRect) => void — opens the day-level call time picker
  activeCallTimeDayId, // dayId of the day whose call time popup is currently open
  dayCallTimeStr,      // resolved call time string — independent of first scene block time
  onOpenLunchPopup,    // (dayId, lunchBlock, DOMRect) => void
  activeLunchBlockId,  // blockId of the lunch block whose popup is open
  onToggleWrap,        // (dayId, show: boolean) => void
  onOpenWrapPopup,     // (dayId, wrapBlock, DOMRect) => void
}) {
  const [editingBlock, setEditingBlock] = React.useState(null);
  const [editValue, setEditValue] = React.useState("");

  const isCollapsed = day.isCollapsed || false;

  const handleDoubleClickEmpty = (blockId) => {
    setEditingBlock(blockId);
    setEditValue("");
  };

  const saveCustomItem = () => {
    if (editValue.trim() && editingBlock) {
      updateCustomItem(day.id, editingBlock, editValue.trim());
      setEditingBlock(null);
      setEditValue("");
    }
  };

  const cancelEdit = () => {
    setEditingBlock(null);
    setEditValue("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      saveCustomItem();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  return (
    <div
      id={`day-${day.id}`}
      style={{ marginBottom: "30px", border: "1px solid #000" }}
    >
      {/* Day Header */}
      <div
        style={{
          backgroundColor: day.isLocked ? "#1B5E20" : "#2E7D32",
          color: "white",
          fontWeight: "bold",
          fontSize: "14px",
          padding: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left controls: collapse toggle + call time */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <button
            onClick={() => updateDayCollapse(day.id, !isCollapsed)}
            style={{
              backgroundColor: "transparent",
              border: "1px solid white",
              color: "white",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "12px",
              padding: "4px 8px",
              fontWeight: "bold",
            }}
          >
            {isCollapsed ? "+" : "−"}
          </button>

          {/* Call Time button — opens CallTimePopup via module-level state */}
          {(() => {
            const isActive = activeCallTimeDayId === day.id;
            return (
              <button
                onClick={(e) => {
                  if (!canEdit) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOpenCallTimePopup(day.id, rect);
                }}
                title="Set call time for this day"
                style={{
                  backgroundColor: isActive ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)",
                  border: `1px solid ${isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)"}`,
                  color: "white",
                  borderRadius: "3px",
                  cursor: canEdit ? "pointer" : "default",
                  fontSize: "11px",
                  padding: "3px 7px",
                  fontWeight: "700",
                  fontFamily: "'Questrial','Futura','Arial',sans-serif",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                ☎ {dayCallTimeStr}
              </button>
            );
          })()}
        </div>

        <div style={{ flex: 1, textAlign: "center" }}>
          DAY {day.dayNumber} -{" "}
          {(() => {
            if (!day.date) return null;
            const [year, month, dayNum] = day.date.split("-");
            const date = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(dayNum)
            );
            return date.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            });
          })()}
          {day.isLocked && (
            <span style={{ marginLeft: "10px" }}>🔒 LOCKED</span>
          )}
        </div>

        {/* Right-side spacer keeps title centered — matches left control width visually */}
        <div style={{ minWidth: "60px", flexShrink: 0 }}></div>
      </div>

      {/* Collapsed State Summary */}
      {isCollapsed && (
        <div
          style={{
            backgroundColor: "#f5f5f5",
            padding: "15px",
            textAlign: "center",
            fontSize: "12px",
            color: "#666",
            borderBottom: "1px solid #ddd",
          }}
        >
          {(() => {
            const sceneCount = day.scheduleBlocks.filter(
              (block) => block.scene && !block.isLunch
            ).length;
            const hasLunch = day.scheduleBlocks.some((block) => block.isLunch);
            return `${sceneCount} scenes scheduled${
              hasLunch ? " + lunch break" : ""
            }`;
          })()}
          {day.isLocked && (
            <span
              style={{
                marginLeft: "10px",
                color: "#4CAF50",
                fontWeight: "bold",
              }}
            >
              ✓ Completed
            </span>
          )}
        </div>
      )}

      {/* Schedule Blocks - only show if not collapsed */}
      {!isCollapsed && (() => {
        // Build displayRows so split continuations appear AFTER the lunch row,
        // not immediately after the pre-lunch scene row.
        // Each entry: { type: "block"|"continuation", block?, index?, tlEntry? }
        const pendingContinuations = []; // held here until lunch is rendered
        const displayRows = [];
        (day.scheduleBlocks || []).forEach((block, index) => {
          displayRows.push({ type: "block", block, index });
          if (block.isLunch) {
            // Flush all held continuations immediately after lunch
            pendingContinuations.forEach(c => displayRows.push(c));
            pendingContinuations.length = 0;
          } else if (!block.isEndOfDay) {
            // Check if this block crosses lunch; if so, hold the continuation
            const tlEntry = dayTimeline ? dayTimeline.find(t => t.block.id === block.id) : null;
            if (tlEntry?.crossesLunch && tlEntry?.postLunchStart != null) {
              pendingContinuations.push({ type: "continuation", block, index, tlEntry });
            }
          }
        });
        // Edge case: no lunch block found — render any orphaned continuations at end
        pendingContinuations.forEach(c => displayRows.push(c));

        return displayRows.map((row) => {
          if (row.type === "continuation") {
            const { block, index, tlEntry } = row;
            const scene = block.scene;
            const FF_MB = "'Questrial','Futura','Arial',sans-serif";
            const contDurMins = tlEntry.postLunchEnd != null ? (tlEntry.postLunchEnd - tlEntry.postLunchStart) : 0;
            return (
              <div
                key={`${block.id}-split`}
                style={{
                  display: "flex", alignItems: "center",
                  backgroundColor: "#fff9e6",
                  border: "1px solid #f9a825",
                  borderTop: "none",
                  minHeight: "28px", fontSize: "11px", padding: "3px 5px",
                  minWidth: 0, overflowX: "hidden",
                }}
              >
                {/* Timing columns: Start | Dur | End */}
                <div style={{ display: "flex", alignItems: "center", flexShrink: 0, gap: "2px", paddingLeft: "4px", paddingRight: "2px" }}>
                  <div style={{ width: "56px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: "#e65100", fontFamily: FF_MB, display: "block", padding: "3px 4px" }}>
                      {fmtTimeMins(tlEntry.postLunchStart)}
                    </span>
                  </div>
                  <div style={{ width: "44px", fontSize: "9px", color: "#a0785a", fontFamily: FF_MB, textAlign: "center", flexShrink: 0 }}>
                    {contDurMins > 0 ? fmtDurMins(contDurMins) : ""}
                  </div>
                  <div style={{ width: "48px", fontSize: "9px", color: "#a0785a", fontFamily: FF_MB, textAlign: "left", flexShrink: 0 }}>
                    {tlEntry.postLunchEnd != null ? fmtTimeMins(tlEntry.postLunchEnd) : ""}
                  </div>
                </div>
                <div style={{ flex: 1, padding: "0 4px", minWidth: 0, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "10px", color: "#795548", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FF_MB }}>
                      {scene
                        ? `Scene ${getSceneDisplayLabel(scene, displayLabelMap)} (cont.)`
                        : block.customItem ? `${block.customItem} (cont.)` : "(cont.)"}
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: "700", color: "#e65100", backgroundColor: "#fff3e0", border: "1px solid #ffcc02", padding: "1px 5px", borderRadius: "3px", flexShrink: 0, fontFamily: FF_MB }}>
                      SPLIT
                    </span>
                  </div>
                </div>
                <div style={{ width: "35px", flexShrink: 0 }} />
              </div>
            );
          }

          const { block, index } = row;
          if (block.isEndOfDay) {
            return (
              <div
                key={block.id}
                style={{
                  backgroundColor: "#000",
                  color: "white",
                  textAlign: "center",
                  padding: "15px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  {canEdit && !day.isLocked && (
                    <button
                      onClick={() => removeShootingDay(day.id)}
                      style={{
                        background: "#ff4444",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                      title="Remove this day"
                    >
                      ✖ Remove Day
                    </button>
                  )}
                  <span>END OF DAY {day.dayNumber} - </span>
                  <input
                    type="date"
                    value={day.date}
                    onChange={(e) =>
                      updateShootingDayDate(day.id, e.target.value)
                    }
                    style={{
                      border: "1px solid #ccc",
                      padding: "2px 4px",
                      fontSize: "12px",
                      backgroundColor: day.isLocked ? "#f5f5f5" : "white",
                    }}
                    disabled={day.isLocked || !canEdit}
                  />
                </div>
                {/* Show Wrap checkbox */}
                {canEdit && !day.isLocked && (
                  <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "11px", color: "white", userSelect: "none", fontFamily: "'Questrial','Futura','Arial',sans-serif" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(day.scheduleBlocks?.some(b => b.isWrap))}
                      onChange={e => onToggleWrap && onToggleWrap(day.id, e.target.checked)}
                      style={{ cursor: "pointer" }}
                    />
                    Wrap
                  </label>
                )}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <button
                    onClick={() => addBlock(day.id)}
                    disabled={day.isLocked}
                    style={{
                      backgroundColor: day.isLocked ? "#ccc" : "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: day.isLocked ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      padding: "4px 6px",
                      fontWeight: "bold",
                    }}
                  >
                    +
                  </button>
                  <button
                    onClick={() =>
                      day.isLocked
                        ? unlockDay(day.id)
                        : lockDayAndMarkShot(day.id)
                    }
                    style={{
                      backgroundColor: day.isLocked ? "#666" : "#FF6B35",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "4px 8px",
                      fontWeight: "bold",
                    }}
                  >
                    {day.isLocked ? "Unlock Day" : "Lock & Mark Shot"}
                  </button>
                </div>
              </div>
            );
          }

          if (block.isLunch) {
            const showDropBefore = dropIndicator?.dayId === day.id && dropIndicator?.blockId === block.id && dropIndicator?.position === "before";
            const showDropAfter = dropIndicator?.dayId === day.id && dropIndicator?.blockId === block.id && dropIndicator?.position === "after";
            return (
              <div
                key={block.id}
                onDrop={day.isLocked ? null : (e) => onDrop(e, day.id, block.id)}
                onDragOver={day.isLocked ? null : (e) => handleDragOver(e, day.id, block.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "#757575",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  borderTop: showDropBefore ? "3px solid #2196F3" : "1px solid #000",
                  borderBottom: showDropAfter ? "3px solid #2196F3" : "1px solid #000",
                  minHeight: "40px",
                  padding: "5px",
                }}
              >
                {/* Timing columns: Start | Dur | End */}
                <div style={{ display: "flex", alignItems: "center", flexShrink: 0, gap: "2px", paddingLeft: "4px", paddingRight: "2px" }}>
                  <div style={{ width: "56px" }}>
                    <button
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        onOpenLunchPopup(day.id, block, rect);
                      }}
                      style={{
                        width: "100%", fontSize: "10px", padding: "3px 4px",
                        border: `1px solid ${activeLunchBlockId === block.id ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)"}`,
                        borderRadius: "3px",
                        backgroundColor: activeLunchBlockId === block.id ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)",
                        color: "white", cursor: "pointer", textAlign: "left",
                        fontFamily: "'Questrial','Futura','Arial',sans-serif",
                      }}
                    >
                      {block.time}
                    </button>
                  </div>
                  {(() => {
                    const lDur = typeof block.durationMinutes === "number" && block.durationMinutes > 0 ? block.durationMinutes : DEFAULT_LUNCH_DUR;
                    const lEnd = fmtTimeMins((parseTimeMins(block.time) ?? 0) + lDur);
                    return (
                      <>
                        <div style={{ width: "40px", fontSize: "9px", color: "rgba(255,255,255,0.75)", fontFamily: "'Questrial','Futura','Arial',sans-serif", textAlign: "center", flexShrink: 0 }}>
                          {fmtDurMins(lDur)}
                        </div>
                        <div style={{ width: "48px", fontSize: "9px", color: "rgba(255,255,255,0.75)", fontFamily: "'Questrial','Futura','Arial',sans-serif", textAlign: "left", flexShrink: 0 }}>
                          {lEnd}
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div
                  draggable={true}
                  onDragEnd={handleDragEnd}
                  onDragStart={(e) => {
                    const lunchScene = {
                      sceneNumber: "LUNCH",
                      metadata: { intExt: "", location: "", timeOfDay: "" },
                      heading: "LUNCH BREAK",
                      estimatedDuration: "60min",
                      isLunch: true,
                    };
                    handleDragStart(
                      e,
                      lunchScene,
                      "scheduled",
                      day.id,
                      block.id
                    );
                  }}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    cursor: "grab",
                    padding: "5px",
                    borderRadius: "3px",
                    minWidth: 0,
                    overflow: "hidden",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "rgba(255,255,255,0.1)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "transparent";
                  }}
                >
                  LUNCH
                </div>
                <div style={{ width: "35px", flexShrink: 0 }}></div>
              </div>
            );
          }

          // ── Wrap block ────────────────────────────────────────────────────
          if (block.isWrap) {
            const FF_W = "'Questrial','Futura','Arial',sans-serif";
            const wrapDur = typeof block.durationMinutes === "number" && block.durationMinutes > 0
              ? block.durationMinutes : 30;
            const wrapStartMins = parseTimeMins(block.time) ?? 0;
            const wrapEndMins   = wrapStartMins + wrapDur;

            // Detect OVERTIME on wrap block: any scheduled scene's trueEnd > wrapEndMins
            const wrapIsOvertime = dayTimeline
              ? dayTimeline.some(t => {
                  if (!isPopulated(t.block)) return false;
                  const te = t.crossesLunch ? (t.postLunchEnd ?? t.bEnd) : t.bEnd;
                  return te > wrapEndMins;
                })
              : false;

            return (
              <div
                key={block.id}
                style={{
                  display: "flex", alignItems: "center",
                  backgroundColor: wrapIsOvertime ? "#4a0000" : "#263238", color: "white",
                  border: `1px solid ${wrapIsOvertime ? "#7f0000" : "#000"}`, minHeight: "36px",
                  fontSize: "12px", padding: "4px 5px",
                  minWidth: 0, overflowX: "hidden",
                }}
              >
                {/* Timing columns: Start | Dur | End — start button opens wrap popup */}
                <div style={{ display: "flex", alignItems: "center", flexShrink: 0, gap: "2px", paddingLeft: "4px", paddingRight: "2px" }}>
                  <div style={{ width: "56px" }}>
                    <button
                      onClick={(e) => {
                        if (!canEdit) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        onOpenWrapPopup && onOpenWrapPopup(day.id, block, rect);
                      }}
                      style={{
                        width: "100%", fontSize: "10px", padding: "3px 4px",
                        border: `1px solid ${wrapIsOvertime ? "rgba(255,200,200,0.5)" : "rgba(255,255,255,0.35)"}`,
                        borderRadius: "3px",
                        backgroundColor: wrapIsOvertime ? "rgba(255,100,100,0.2)" : "rgba(255,255,255,0.12)",
                        color: "white",
                        cursor: canEdit ? "pointer" : "default", textAlign: "left",
                        fontFamily: FF_W, fontWeight: "700",
                      }}
                    >
                      {block.time}
                    </button>
                  </div>
                  <div style={{ width: "44px", fontSize: "9px", color: "rgba(255,255,255,0.6)", fontFamily: FF_W, textAlign: "center", flexShrink: 0 }}>
                    {fmtDurMins(wrapDur)}
                  </div>
                  {/* Wrap end cell — reserve 10px above for OVERTIME badge (same geometry as scene rows) */}
                  <div style={{ width: "48px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
                    <div style={{ height: "10px", display: "flex", alignItems: "center" }}>
                      {wrapIsOvertime && (
                        <span style={{ fontSize: "7px", fontWeight: "700", color: "white", backgroundColor: "#7f0000", padding: "1px 3px", borderRadius: "2px", fontFamily: FF_W, lineHeight: 1, whiteSpace: "nowrap" }}>
                          OVERTIME
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "9px", color: wrapIsOvertime ? "rgba(255,180,180,0.9)" : "rgba(255,255,255,0.6)", fontFamily: FF_W, fontWeight: wrapIsOvertime ? "700" : "400", whiteSpace: "nowrap" }}>
                      {fmtTimeMins(wrapEndMins)}
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, padding: "0 8px", fontWeight: "700", fontSize: "12px", fontFamily: FF_W, letterSpacing: "0.04em" }}>
                  WRAP{wrapIsOvertime && (
                    <span style={{ marginLeft: "8px", fontSize: "9px", fontWeight: "700", color: "rgba(255,180,180,0.9)", letterSpacing: "0.06em" }}>
                      OVERTIME
                    </span>
                  )}
                </div>
                <div style={{ width: "35px", flexShrink: 0 }} />
              </div>
            );
          }

          const scene = block.scene;
          const isOddRow = index % 2 === 1;
          const showDropBefore = dropIndicator?.dayId === day.id && dropIndicator?.blockId === block.id && dropIndicator?.position === "before";
          const showDropAfter = dropIndicator?.dayId === day.id && dropIndicator?.blockId === block.id && dropIndicator?.position === "after";
          const showDropFill = dropIndicator?.dayId === day.id && dropIndicator?.blockId === block.id && dropIndicator?.position === "fill";
          const backgroundColor = scene
            ? getSceneBlockColor(scene, isOddRow)
            : block.customItem
            ? isOddRow
              ? "#FFCDD2"
              : "#BBDEFB"
            : isOddRow
            ? "#FCE4EC"
            : "#E3F2FD";

          const FF_MB = "'Questrial','Futura','Arial',sans-serif";

          return (
            <div
              key={block.id}
              onDrop={day.isLocked ? null : (e) => onDrop(e, day.id, block.id)}
              onDragOver={day.isLocked ? null : (e) => handleDragOver(e, day.id, block.id)}
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: backgroundColor,
                border: "1px solid #ddd",
                borderTop: showDropBefore ? "3px solid #2196F3" : "1px solid #ddd",
                borderBottom: showDropAfter ? "3px solid #2196F3" : "1px solid #ddd",
                boxShadow: showDropFill ? "inset 0 0 0 3px #2196F3" : "none",
                minHeight: "40px",
                fontSize: "12px",
                padding: "5px",
                minWidth: 0,
                overflowX: "hidden",
              }}
            >
              {/* Timing columns: Start | Dur | End+status badge */}
              {(() => {
                const tlEntry = dayTimeline ? dayTimeline.find(t => t.block.id === block.id) : null;
                const isActive = activePopupBlockId === block.id;
                const FF_T = "'Questrial','Futura','Arial',sans-serif";
                // Duration display: use scene estimatedDuration, default 30 min
                const durStr = scene?.estimatedDuration || (block.customItem ? "" : "");
                const durDisplay = durStr ? durStr : (isPopulated(block) ? "30 min" : "");
                // Wall-clock end: use tlEntry if available (accounts for lunch crossing)
                const trueEnd = tlEntry && isPopulated(block)
                  ? (tlEntry.crossesLunch ? (tlEntry.postLunchEnd ?? tlEntry.bEnd) : tlEntry.bEnd)
                  : null;
                const endDisplay = trueEnd != null ? fmtTimeMins(trueEnd) : "";

                // Scheduled timing status: "normal" | "over" | "overtime"
                // "over"     — scene end > wrap start  (eating into wrap time)
                // "overtime" — scene end > wrap end    (pushed past end of scheduled day)
                // Only applies when a wrap block exists. No wrap = no warning.
                const scheduledTimingStatus = (() => {
                  const wrapBlock = (day.scheduleBlocks || []).find(b => b.isWrap);
                  if (!wrapBlock || trueEnd == null || !isPopulated(block)) return "normal";
                  const dayCallMinsForWrap = parseTimeMins(dayCallTimeStr) ?? 8 * 60;
                  const wrapDurMins = typeof wrapBlock.durationMinutes === "number" && wrapBlock.durationMinutes > 0
                    ? wrapBlock.durationMinutes : 30;
                  const wrapEndMins   = dayCallMinsForWrap + 12.5 * 60;
                  const wrapStartMins = wrapEndMins - wrapDurMins;
                  if (trueEnd > wrapEndMins)   return "overtime"; // past end of scheduled day
                  if (trueEnd > wrapStartMins) return "over";     // eating into wrap
                  return "normal";
                })();

                const isOver     = scheduledTimingStatus === "over";
                const isOvertime = scheduledTimingStatus === "overtime";
                const isWarned   = isOver || isOvertime;

                // Visual tokens per status
                const btnBg    = isActive ? "#1565c0" : isOvertime ? "#4a0000" : isOver ? "#c62828" : "#e8eaf6";
                const btnBd    = isActive ? "#1565c0" : isOvertime ? "#7f0000" : isOver ? "#b71c1c" : "#bbb";
                const btnColor = isActive ? "white"   : isWarned   ? "white"   : "#333";
                const textColor = isOvertime ? "#7f0000" : isOver ? "#c62828" : "rgba(0,0,0,0.45)";
                const badgeBg   = isOvertime ? "#7f0000" : "#c62828";
                const badgeText = isOvertime ? "OVERTIME" : "OVER";

                return (
                  <div style={{ display: "flex", alignItems: "center", flexShrink: 0, gap: "2px", paddingLeft: "4px", paddingRight: "2px" }}>
                    {/* Start Time button — solid red (OVER) or dark maroon (OVERTIME) */}
                    <div style={{ width: "56px" }}>
                      <button
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          onOpenTimePopup(day.id, block.id, rect);
                        }}
                        style={{
                          width: "100%", fontSize: "10px", padding: "3px 4px",
                          border: `1px solid ${btnBd}`,
                          borderRadius: "3px",
                          backgroundColor: btnBg,
                          color: btnColor,
                          cursor: "pointer", textAlign: "left",
                          fontFamily: FF_T,
                          fontWeight: isActive || isWarned ? "700" : "500",
                        }}
                      >
                        {block.time}
                      </button>
                    </div>
                    {/* Duration */}
                    <div style={{ width: "44px", fontSize: "9px", color: textColor, fontFamily: FF_T, textAlign: "center", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isWarned ? "700" : "400" }}>
                      {durDisplay}
                    </div>
                    {/* End Time — badge (OVER / OVERTIME) sits in fixed 10px row above end text.
                        The 10px row is always present so row height stays stable. */}
                    <div style={{ width: "48px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
                      <div style={{ height: "10px", display: "flex", alignItems: "center" }}>
                        {isWarned && (
                          <span style={{ fontSize: "7px", fontWeight: "700", color: "white", backgroundColor: badgeBg, padding: "1px 3px", borderRadius: "2px", fontFamily: FF_T, lineHeight: 1, whiteSpace: "nowrap" }}>
                            {badgeText}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "9px", color: textColor, fontFamily: FF_T, fontWeight: isWarned ? "700" : "400", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                        {endDisplay}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div
                style={{
                  flex: 1,
                  padding: "0 8px",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                {scene ? (
                  <div
                    draggable={true}
                    onDragStart={(e) =>
                      handleDragStart(e, scene, "scheduled", day.id, block.id)
                    }
                    onDragEnd={handleDragEnd}
                    onDoubleClick={() => handleSceneDoubleClick(scene)}
                    title="Double-click to view script"
                    style={{
                      cursor: "grab",
                      padding: "4px",
                      borderRadius: "3px",
                      border: "1px dashed rgba(0,0,0,0.2)",
                      borderLeft: Boolean(scene.metadata?.replacementLetter) ? `3px solid ${INSERTED_BORDER_COLOR}` : "1px dashed rgba(0,0,0,0.2)",
                      color: getSceneBlockTextColor(scene),
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = "rgba(255,255,255,0.3)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "transparent";
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      Scene {getSceneDisplayLabel(scene, displayLabelMap)}: {scene.metadata?.intExt} -{" "}
                      {scene.metadata?.location}
                    </strong>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {scene.heading} | {scene.metadata?.timeOfDay} |{" "}
                      {scene.estimatedDuration}
                    </div>
                  </div>
                ) : block.customItem ? (
                  <div
                    draggable={true}
                    onDragEnd={handleDragEnd}
                    onDragStart={(e) => {
                      const customScene = {
                        sceneNumber: "CUSTOM",
                        metadata: { intExt: "", location: "", timeOfDay: "" },
                        heading: block.customItem,
                        estimatedDuration: "TBD",
                        isCustom: true,
                      };
                      handleDragStart(
                        e,
                        customScene,
                        "scheduled",
                        day.id,
                        block.id
                      );
                    }}
                    style={{
                      cursor: "grab",
                      padding: "4px",
                      borderRadius: "3px",
                      border: "1px dashed #FF9800",
                      backgroundColor: "rgba(255, 152, 0, 0.1)",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = "rgba(255, 152, 0, 0.2)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "rgba(255, 152, 0, 0.1)";
                    }}
                  >
                    <strong style={{ color: "#FF6F00" }}>
                      📝 {block.customItem}
                    </strong>
                    <div style={{ fontSize: "11px", color: "#BF5F00" }}>
                      Custom Schedule Item
                    </div>
                  </div>
                ) : editingBlock === block.id ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Enter custom item..."
                      autoFocus
                      style={{
                        flex: 1,
                        padding: "4px 8px",
                        fontSize: "12px",
                        border: "2px solid #2196F3",
                        borderRadius: "3px",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={saveCustomItem}
                      style={{
                        backgroundColor: "#4CAF50",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "2px",
                        cursor: "pointer",
                        fontSize: "10px",
                      }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "2px",
                        cursor: "pointer",
                        fontSize: "10px",
                      }}
                    >
                      ✗
                    </button>
                  </div>
                ) : (
                  <em
                    style={{ color: "#999", cursor: "pointer" }}
                    onDoubleClick={() => handleDoubleClickEmpty(block.id)}
                    title="Double-click to add custom item"
                  >
                    Empty time slot
                  </em>
                )}
              </div>

              <div
                style={{ width: "35px", textAlign: "center", flexShrink: 0 }}
              >
                {scene ? (
                  <button
                    onClick={() => removeScene(day.id, block.id)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "4px 6px",
                    }}
                  >
                    ×
                  </button>
                ) : block.customItem ? (
                  <button
                    onClick={() => updateCustomItem(day.id, block.id, null)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "4px 6px",
                    }}
                  >
                    ×
                  </button>
                ) : (
                  <button
                    onClick={() => removeBlock(day.id, block.id)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "4px 6px",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}

function StripboardScheduleModule({
  selectedProject,
  syncLocks,
  stripboardScenes,
  scheduledScenes,
  onScheduleScene,
  onUnscheduleScene,
  shootingDays,
  setShootingDays,
  setScheduledScenes,
  setStripboardScenes,
  scriptLocations,
  scenes,
  setScenes,
  onUpdateScene,
  onSyncAllShootingDays,
  saveScenesDatabase,
  onSyncStripboardScenes,
  onSyncScheduledScenes,
  syncShootingDays,
  canEdit,
  callSheetData,         // optional — for call time sync
  setCallSheetData,      // optional
  syncCallSheetData,     // optional
}) {
  const [draggedItem, setDraggedItem] = useState(null);
  const scrollContainerRef = useRef(null);
  const [selectedStatuses, setSelectedStatuses] = React.useState([
    "Not Scheduled",
    "Reshoot",
    "Pickups",
  ]);
  const [selectedParentLocation, setSelectedParentLocation] = useState("");
  const [selectedSubLocations, setSelectedSubLocations] = useState([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showScriptPopup, setShowScriptPopup] = useState(false);
  const [selectedSceneForScript, setSelectedSceneForScript] = useState(null);
  const [scriptFullMode, setScriptFullMode] = useState(false);
  const [scriptFullIndex, setScriptFullIndex] = useState(0);
  const [dropIndicator, setDropIndicator] = useState(null);
  const [timePopup, setTimePopup] = useState(null); // { dayId, blockId, block, day, anchorRect }
  const [callTimePopup, setCallTimePopup] = useState(null); // { dayId, anchorRect, currentCallMins }
  const [lunchTimePopup, setLunchTimePopup] = useState(null); // { dayId, lunchBlock, anchorRect }
  const [wrapPopup, setWrapPopup] = useState(null); // { dayId, wrapBlock, anchorRect, callTimeMins }

  const lockQueue = useRef([]);
  const lockTimeout = useRef(null);
  const displayLabelMap = useMemo(() => buildSceneDisplayLabelMap(scenes), [scenes]);

  useEffect(() => {
    if (!scrollContainerRef.current || !shootingDays.length) return;

    const storageKey = "stripboard-schedule-scroll-position";
    const hasAutoScrolledKey = "stripboard-schedule-has-auto-scrolled";

    const savedPosition = sessionStorage.getItem(storageKey);
    const hasAutoScrolled = sessionStorage.getItem(hasAutoScrolledKey);

    if (savedPosition !== null) {
      scrollContainerRef.current.scrollTop = parseInt(savedPosition, 10);
      return;
    }

    if (hasAutoScrolled === "true") return;

    const firstActiveDay = shootingDays.find(
      (day) => !day.isLocked && !day.isCollapsed
    );

    if (firstActiveDay) {
      setTimeout(() => {
        const dayElement = document.getElementById(`day-${firstActiveDay.id}`);
        if (dayElement && scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = dayElement.offsetTop - 20;
          sessionStorage.setItem(hasAutoScrolledKey, "true");
        }
      }, 0);
    } else {
      scrollContainerRef.current.scrollTop = 0;
      sessionStorage.setItem(hasAutoScrolledKey, "true");
    }
  }, [shootingDays]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      sessionStorage.setItem(
        "stripboard-schedule-scroll-position",
        scrollContainerRef.current.scrollTop.toString()
      );
    }
  };

  const handleSceneDoubleClick = (scene) => {
    if (scene && scene.sceneNumber && scenes) {
      const scriptScene = scenes.find(
        (s) => sameScene(s, scene)
      );
      if (scriptScene) {
        setSelectedSceneForScript(scriptScene);
        setShowScriptPopup(true);
      }
    }
  };

  const closeScriptPopup = () => {
    setShowScriptPopup(false);
    setSelectedSceneForScript(null);
    setScriptFullMode(false);
  };

  const getSceneStatusColor = (sceneNumber) => {
    const stripboardScene = stripboardScenes?.find(
      (s) => s.sceneNumber === sceneNumber
    );
    const status = stripboardScene?.status || "Not Scheduled";
    const statusColors = {
      Scheduled: "#e8f5e9",
      Shot: "#e8f5e9",
      Pickups: "#fff8e1",
      Reshoot: "#ffebee",
      Complete: "#e3f2fd",
      "In Progress": "#f3e5f5",
      "Not Scheduled": "transparent",
    };
    return statusColors[status] || "transparent";
  };

  const getScheduleElementStyle = (type) => {
    const baseStyle = {
      fontFamily: "Courier New, monospace",
      fontSize: "12pt",
      lineHeight: "12pt",
      marginBottom: "12pt",
      color: "#000",
    };
    switch (type) {
      case "Character":
        return { ...baseStyle, marginLeft: "200px", textTransform: "uppercase", fontWeight: "normal" };
      case "Dialogue":
        return { ...baseStyle, marginLeft: "100px", marginRight: "100px" };
      case "Parenthetical":
        return { ...baseStyle, marginLeft: "150px", fontStyle: "italic" };
      case "Action":
        return { ...baseStyle, marginLeft: "0", marginRight: "0" };
      case "Scene Heading":
        return { ...baseStyle, marginLeft: "0", marginRight: "0", textTransform: "uppercase", fontWeight: "bold", marginTop: "24pt" };
      default:
        return baseStyle;
    }
  };

  const formatScheduleElementText = (block) => {
    let text = block.text;
    if (block.formatting) {
      if (block.formatting.bold) return React.createElement("strong", null, text);
      if (block.formatting.italic) return React.createElement("em", null, text);
      if (block.formatting.underline) return React.createElement("u", null, text);
    }
    if (block.type === "Character" && text.includes("(")) {
      const parts = text.split("(");
      const name = parts[0].trim();
      const extension = parts[1] ? `(${parts[1]}` : "";
      return React.createElement("span", null, name, extension && React.createElement("span", { style: { fontWeight: "normal" } }, ` ${extension}`));
    }
    return text;
  };

  const createDefaultScheduleBlocks = () => {
    const blocks = [];
    for (let i = 0; i < 6; i++) {
      blocks.push({ id: crypto.randomUUID(), scene: null, time: "8:00 AM", type: "scene" });
    }
    blocks.push({ id: crypto.randomUUID(), scene: null, time: "12:00 PM", type: "lunch", isLunch: true });
    blocks.push({ id: crypto.randomUUID(), scene: null, time: "1:00 PM", type: "scene" });
    blocks.push({ id: crypto.randomUUID(), scene: null, time: "2:00 PM", type: "scene" });
    blocks.push({ id: crypto.randomUUID(), scene: null, time: "END OF DAY", type: "endofday", isEndOfDay: true });
    return blocks;
  };

  const addShootingDay = () => {
    let nextDate;
    if (shootingDays.length === 0) {
      nextDate = new Date();
    } else {
      const lastDay = shootingDays[shootingDays.length - 1];
      nextDate = new Date(lastDay.date);
      nextDate.setDate(nextDate.getDate() + 1);
    }
    const newDay = {
      id: crypto.randomUUID(),
      date: nextDate.toISOString().split("T")[0],
      dayNumber: shootingDays.length + 1,
      scheduleBlocks: createDefaultScheduleBlocks(),
    };
    const updatedDays = [...shootingDays, newDay];
    console.log("🔄 Creating shooting day and syncing to database:", {
      dayId: newDay.id,
      date: newDay.date,
      dayNumber: newDay.dayNumber,
    });
    setShootingDays(updatedDays);
    if (typeof onSyncAllShootingDays === "function") {
      onSyncAllShootingDays(updatedDays);
    } else if (typeof syncShootingDays === "function") {
      syncShootingDays(updatedDays);
    }
  };

  const removeShootingDay = (dayId) => {
    const dayToRemove = shootingDays.find((day) => day.id === dayId);
    if (!dayToRemove) { alert("Day not found."); return; }

    const confirmMessage = `Remove Day ${dayToRemove.dayNumber} (${dayToRemove.date})?`;
    if (!window.confirm(confirmMessage)) return;

    const updatedDays = shootingDays.filter((day) => day.id !== dayId);
    const renumberedDays = updatedDays
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((day, index) => ({ ...day, dayNumber: index + 1 }));

    setShootingDays(renumberedDays);

    database
      .deleteShootingDay(selectedProject, dayId)
      .then(() => {
        const dayNumberUpdates = renumberedDays.map((day) => ({ dayId: day.id, dayNumber: day.dayNumber }));
        return database.batchUpdateDayNumbers(selectedProject, dayNumberUpdates);
      })
      .then(() => {})
      .catch((error) => {
        console.error("❌ Atomic remove failed:", error);
        alert("⚠️ Failed to remove day. Please try again.");
      });
  };

  const updateShootingDayDate = (dayId, newDate) => {
    setShootingDays((days) => {
      const duplicateDay = days.find((day) => day.id !== dayId && day.date === newDate);
      if (duplicateDay) {
        alert(`Error: Day ${duplicateDay.dayNumber} is already scheduled for ${newDate}. Please choose a different date.`);
        return days;
      }

      const updatedDays = days.map((day) =>
        day.id === dayId ? { ...day, date: newDate } : day
      );
      const sortedDays = [...updatedDays].sort((a, b) => new Date(a.date) - new Date(b.date));
      const renumberedDays = sortedDays.map((day, index) => ({ ...day, dayNumber: index + 1 }));

      setShootingDays(renumberedDays);

      if (typeof onSyncAllShootingDays === "function") {
        onSyncAllShootingDays(renumberedDays);
      }

      const updatedDay = updatedDays.find((day) => day.id === dayId);
      const oldDay = days.find((day) => day.id === dayId);

      if (updatedDay && oldDay && updatedDay.date !== oldDay.date) {
        const newScheduledScenes = { ...scheduledScenes };
        const dayScenes = updatedDay.scheduleBlocks
          .filter((block) => block.scene !== null)
          .map((block) => block.scene);

        if (newScheduledScenes[oldDay.date]) {
          newScheduledScenes[oldDay.date] = newScheduledScenes[oldDay.date].filter(
            (scene) => !dayScenes.some((dayScene) => sameScene(dayScene, scene))
          );
          if (newScheduledScenes[oldDay.date].length === 0) delete newScheduledScenes[oldDay.date];
        }

        if (dayScenes.length > 0) {
          if (!newScheduledScenes[newDate]) newScheduledScenes[newDate] = [];
          dayScenes.forEach((scene) => {
            const sceneIndex = stripboardScenes.findIndex((s) => sameScene(s, scene));
            if (sceneIndex !== -1) {
              const updatedStripboard = [...stripboardScenes];
              updatedStripboard[sceneIndex].scheduledDate = newDate;
              setStripboardScenes(updatedStripboard);
            }
            if (!newScheduledScenes[newDate].some((s) => sameScene(s, scene))) {
              newScheduledScenes[newDate].push(normalizeSceneRef(scene));
            }
          });
        }

        setScheduledScenes(newScheduledScenes);
      }

      return updatedDays;
    });
  };

  const getLocationHierarchy = () => {
    const hierarchy = {};
    if (scriptLocations) {
      scriptLocations.forEach((location) => {
        const parent = location.parentLocation;
        const sub = location.subLocation;
        if (!hierarchy[parent]) hierarchy[parent] = [];
        if (!hierarchy[parent].includes(sub)) hierarchy[parent].push(sub);
      });
    }
    return hierarchy;
  };

  const locationHierarchy = getLocationHierarchy();
  const statusOptions = ["Not Scheduled", "Scheduled", "Shot", "Pickups", "Reshoot"];

  const getStatusColor = (status) => {
    switch (status) {
      case "Scheduled": return "#2196F3";
      case "Shot": return "#4CAF50";
      case "Pickups": return "#FFC107";
      case "Reshoot": return "#F44336";
      default: return "#f0f0f0";
    }
  };

  const getStatusTextColor = (status) => {
    return status === "Pickups" ? "black" : status === "Not Scheduled" ? "#666" : "white";
  };

  const getSceneBlockColor = (scene, isOddRow) => {
    if (!scene) return "transparent";
    const currentScene = stripboardScenes.find((s) => sameScene(s, scene));
    const status = currentScene?.status || scene.status || "Not Scheduled";
    switch (status) {
      case "Reshoot":
      case "Scheduled Reshoot":
      case "Shot Reshoot":
        return "#F44336";
      case "Pickups":
      case "Scheduled Pickups":
      case "Shot Pickups":
        return "#FFC107";
      default:
        return isOddRow ? "#FFCDD2" : "#BBDEFB";
    }
  };

  const getSceneBlockTextColor = (scene) => {
    if (!scene) return "black";
    const status = scene.status || "Not Scheduled";
    switch (status) {
      case "Reshoot":
      case "Scheduled Reshoot":
      case "Shot Reshoot":
        return "white";
      default:
        return "black";
    }
  };

  const handleParentLocationChange = (parentLocation) => {
    setSelectedParentLocation(parentLocation);
    setSelectedSubLocations([]);
  };

  const handleSelectAllSubLocations = () => {
    if (selectedParentLocation && locationHierarchy[selectedParentLocation]) {
      setSelectedSubLocations([...locationHierarchy[selectedParentLocation]]);
    }
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 0) options.push(`12:${minute.toString().padStart(2, "0")} AM`);
        else if (hour < 12) options.push(`${hour}:${minute.toString().padStart(2, "0")} AM`);
        else if (hour === 12) options.push(`12:${minute.toString().padStart(2, "0")} PM`);
        else options.push(`${hour - 12}:${minute.toString().padStart(2, "0")} PM`);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const getFilteredScenes = () => {
    let filtered = stripboardScenes;
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((scene) => {
        const status = scene.status || "Not Scheduled";
        const isScheduled = !!scene.scheduledDate;
        if (isScheduled && (status === "Pickups" || status === "Reshoot")) return false;
        return selectedStatuses.includes(status);
      });
    }
    if (selectedParentLocation) {
      filtered = filtered.filter((scene) => {
        const sceneLocation = scene.metadata?.location || "";
        const matchesParent = sceneLocation.toUpperCase().includes(selectedParentLocation.toUpperCase());
        if (selectedSubLocations.length > 0) {
          const matchesSubLocation = selectedSubLocations.some((subLoc) =>
            sceneLocation.toUpperCase().includes(subLoc.toUpperCase())
          );
          return matchesParent && matchesSubLocation;
        }
        return matchesParent;
      });
    }
    return filtered;
  };

  const availableScenes = getFilteredScenes();

  const getDropPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY <= rect.top + rect.height / 2 ? "before" : "after";
  };

  const normalizeOrderedBlocks = (blocks = []) => {
    const endOfDayBlock = blocks.find((block) => block.isEndOfDay);
    const orderedBlocks = blocks
      .filter((block) => !block.isEndOfDay)
      .map((block) => normalizeScheduleBlock(block));

    return endOfDayBlock
      ? [...orderedBlocks, normalizeScheduleBlock(endOfDayBlock)]
      : orderedBlocks;
  };

  const isLunchBlock = (block) => Boolean(block?.isLunch || block?.scene?.isLunch);

  const isEmptySceneBlockTarget = (block) => (
    block &&
    block.type === "scene" &&
    !block.scene &&
    !block.customItem &&
    !block.isLunch &&
    !block.isEndOfDay
  );

  const getLunchDividerIndex = (blocks = []) => (
    blocks.filter((block) => !block.isEndOfDay).findIndex(isLunchBlock)
  );

  const assembleBlocksWithLunchAtIndex = (blocks, lunchIndex) => {
    const endOfDayBlock = blocks.find((block) => block.isEndOfDay);
    const bodyBlocks = blocks.filter((block) => !block.isEndOfDay);
    const lunchBlock = bodyBlocks.find(isLunchBlock);
    if (!lunchBlock || lunchIndex < 0) return normalizeOrderedBlocks(blocks);

    const nonLunchBlocks = bodyBlocks.filter((block) => !isLunchBlock(block));
    const nextBlocks = nonLunchBlocks.map((block) => normalizeScheduleBlock(block));
    const insertIndex = Math.max(0, Math.min(lunchIndex, nextBlocks.length));
    nextBlocks.splice(insertIndex, 0, normalizeScheduleBlock(lunchBlock));

    return endOfDayBlock
      ? [...nextBlocks, normalizeScheduleBlock(endOfDayBlock)]
      : nextBlocks;
  };

  const insertBlockAtTarget = (blocks, blockToInsert, targetBlockId, position) => {
    const endOfDayBlock = blocks.find((block) => block.isEndOfDay);
    const bodyBlocks = blocks.filter((block) => !block.isEndOfDay);
    const targetIndex = bodyBlocks.findIndex((block) => block.id === targetBlockId);
    const orderedBlocks = [...bodyBlocks];
    const insertIndex = targetIndex === -1
      ? orderedBlocks.length
      : targetIndex + (position === "after" ? 1 : 0);

    orderedBlocks.splice(insertIndex, 0, normalizeScheduleBlock(blockToInsert));

    return endOfDayBlock
      ? [...orderedBlocks.map((block) => normalizeScheduleBlock(block)), normalizeScheduleBlock(endOfDayBlock)]
      : orderedBlocks.map((block) => normalizeScheduleBlock(block));
  };

  const insertBlockAtTargetPreservingLunch = (blocks, blockToInsert, targetBlockId, position, lunchIndex) => {
    if (isLunchBlock(blockToInsert) || lunchIndex < 0) {
      return insertBlockAtTarget(blocks, blockToInsert, targetBlockId, position);
    }

    const endOfDayBlock = blocks.find((block) => block.isEndOfDay);
    const bodyBlocks = blocks.filter((block) => !block.isEndOfDay);
    const lunchBlock = bodyBlocks.find(isLunchBlock);
    if (!lunchBlock) return insertBlockAtTarget(blocks, blockToInsert, targetBlockId, position);

    const nonLunchBlocks = bodyBlocks.filter((block) => !isLunchBlock(block));
    const targetBlock = bodyBlocks.find((block) => block.id === targetBlockId);
    let insertIndex = nonLunchBlocks.length;

    if (targetBlock) {
      if (isLunchBlock(targetBlock)) {
        insertIndex = position === "before"
          ? Math.max(0, lunchIndex - 1)
          : Math.min(lunchIndex, nonLunchBlocks.length);
      } else {
        const targetNonLunchIndex = nonLunchBlocks.findIndex((block) => block.id === targetBlockId);
        if (targetNonLunchIndex !== -1) {
          insertIndex = targetNonLunchIndex + (position === "after" ? 1 : 0);
        }
      }
    }

    const nextBlocks = nonLunchBlocks.map((block) => normalizeScheduleBlock(block));
    nextBlocks.splice(
      Math.max(0, Math.min(insertIndex, nextBlocks.length)),
      0,
      normalizeScheduleBlock(blockToInsert)
    );
    nextBlocks.splice(
      Math.max(0, Math.min(lunchIndex, nextBlocks.length)),
      0,
      normalizeScheduleBlock(lunchBlock)
    );

    return endOfDayBlock
      ? [...nextBlocks, normalizeScheduleBlock(endOfDayBlock)]
      : nextBlocks;
  };

  // ─── resolveDropIntentAroundLunch ────────────────────────────────────────────
  // Determines the correct structural side-of-lunch for a drop BEFORE insertion.
  // Uses the target block's true wall-clock end (from buildDayTimeline) to detect
  // the boundary case where a scene ends exactly at lunch start.
  //
  // Returns:
  //   "postLunch" — force insertion after lunch (first slot post-lunch)
  //   "normal"    — allow normal insertion logic
  //
  // Rules:
  //   1. targetBlock.isLunch                           → "postLunch"
  //   2. dropPosition === "after" AND targetTrueEnd === lunchMins → "postLunch"
  //   3. targetBlock's stored start >= lunchMins        → "postLunch"
  //   4. otherwise                                      → "normal"
  const resolveDropIntentAroundLunch = (targetBlock, dropPosition, targetBlocks, dayCallMinsVal) => {
    if (!targetBlock) return "normal";
    if (isLunchBlock(targetBlock)) return "postLunch";

    const lunchMins = getLunchStart(targetBlocks, dayCallMinsVal);

    // If target block starts at or after lunch, any drop on it is post-lunch
    const targetStoredStart = parseTimeMins(targetBlock.time);
    if (targetStoredStart != null && targetStoredStart >= lunchMins) return "postLunch";

    // Key boundary case: target's true wall-clock end equals lunchMins
    // Dropping "after" such a block means there's no room before lunch — must go post-lunch.
    if (dropPosition === "after") {
      // Compute target block's true end using the same cascade math the day uses
      const dur = snap15(Math.max(15, parseDurMins(targetBlock.scene?.estimatedDuration)));
      const bStart = targetStoredStart;
      if (bStart != null) {
        // Actual end accounting for lunch crossing
        const bEnd = bStart + dur;
        const crossesLunch = bStart < lunchMins && bEnd > lunchMins;
        const lunchDur = getLunchDur(targetBlocks);
        const trueEnd = crossesLunch ? (lunchMins + lunchDur + (bEnd - lunchMins)) : bEnd;
        if (trueEnd >= lunchMins) return "postLunch";
      }
    }

    return "normal";
  };

  // ─── insertBlockPostLunch ─────────────────────────────────────────────────────
  // Builds a structural block array with blockToInsert placed immediately after
  // the lunch block, before any existing post-lunch scenes.
  // This is the canonical "force post-lunch" insertion used when drop intent is "postLunch"
  // and the target is not the lunch block itself.
  const insertBlockPostLunch = (blocks, blockToInsert) => {
    const endOfDay = blocks.find(b => b.isEndOfDay);
    const body = blocks.filter(b => !b.isEndOfDay);
    const lunchBlock = body.find(isLunchBlock);
    if (!lunchBlock) {
      // No lunch block — fall back to appending before endOfDay
      return endOfDay
        ? [...body.map(b => normalizeScheduleBlock(b)), normalizeScheduleBlock(blockToInsert), normalizeScheduleBlock(endOfDay)]
        : [...body.map(b => normalizeScheduleBlock(b)), normalizeScheduleBlock(blockToInsert)];
    }
    const preLunch  = body.filter((b, i) => !isLunchBlock(b) && !b.isWrap && i < body.findIndex(x => isLunchBlock(x)));
    const postLunch = body.filter((b, i) => !isLunchBlock(b) && !b.isWrap && i > body.findIndex(x => isLunchBlock(x)));
    const wrapBlock = body.find(b => b.isWrap);
    return [
      ...preLunch.map(b => normalizeScheduleBlock(b)),
      normalizeScheduleBlock(lunchBlock),
      normalizeScheduleBlock(blockToInsert),
      ...postLunch.map(b => normalizeScheduleBlock(b)),
      ...(wrapBlock ? [normalizeScheduleBlock(wrapBlock)] : []),
      ...(endOfDay ? [normalizeScheduleBlock(endOfDay)] : []),
    ];
  };

  // ─── resolveLunchAwareDropOrder ──────────────────────────────────────────────
  // After structural insertion, ensures the moved block lands on the correct side
  // of lunch. recalculateDayScheduleBlocks cascades in INPUT array order, so if
  // MovedBlock is before lunch in the array but its computed start is >= lunchMins,
  // the cascade output will physically reorder it — but the cascade of subsequent
  // blocks will have already used the wrong cursor positions.
  //
  // This function does a single dry-run cascade, detects which side of lunch the
  // moved block lands on, and if the structural position is wrong, moves it to the
  // correct side before the real cascade runs.
  //
  // Returns a corrected structural block array (preserving wrap, endOfDay, etc).
  // movedBlockId: the ID of the block just inserted.
  // dayCallMins, sceneStartAnchorMins: passed through to recalculate for the dry run.
  const resolveLunchAwareDropOrder = (blocks, movedBlockId, dayCallMins, sceneStartAnchorMins) => {
    // Quick dry-run through recalculate to get the candidate time for MovedBlock
    const candidate = recalculateDayScheduleBlocks(blocks, { dayCallMins, sceneStartAnchorMins });

    // Find MovedBlock's computed time in the candidate output
    const movedInCandidate = candidate.find(b => b.id === movedBlockId);
    if (!movedInCandidate) return blocks; // not found — leave unchanged

    const movedCandidateStart = parseTimeMins(movedInCandidate.time);
    if (movedCandidateStart == null) return blocks;

    // Compute effective lunch start for this day
    const lunchMins = getLunchStart(blocks, dayCallMins);
    const lunchDur  = getLunchDur(blocks);
    const lunchEnd  = lunchMins + lunchDur;

    // Determine which side of lunch MovedBlock is currently on in the structural array
    const sceneBlocks = blocks.filter(b => !b.isEndOfDay && !b.isLunch && !b.isWrap);
    const lunchBlock  = blocks.find(b => b.isLunch);
    const endOfDay    = blocks.find(b => b.isEndOfDay);
    const wrapBlock   = blocks.find(b => b.isWrap);

    if (!lunchBlock) return blocks; // no lunch — nothing to resolve

    const nonSpecial = blocks.filter(b => !b.isEndOfDay && !b.isLunch && !b.isWrap);
    const lunchIdx   = blocks.filter(b => !b.isEndOfDay).findIndex(b => b.isLunch);
    const movedIdxInFull = blocks.findIndex(b => b.id === movedBlockId);
    if (movedIdxInFull === -1) return blocks;

    // Is MovedBlock currently before or after lunch in the structural array?
    const lunchIdxInFull = blocks.findIndex(b => b.isLunch);
    const movedIsBeforeLunch = movedIdxInFull < lunchIdxInFull;

    // Should MovedBlock be after lunch based on its computed start?
    const movedShouldBeAfterLunch = movedCandidateStart >= lunchMins;

    if (movedIsBeforeLunch === !movedShouldBeAfterLunch) {
      // Structural position matches computed position — candidate output is already correct
      return candidate;
    }

    // Mismatch: structural position is wrong. Move movedBlock to the correct side.
    const withoutMoved = blocks.filter(b => b.id !== movedBlockId);
    const movedBlock = blocks.find(b => b.id === movedBlockId);

    if (movedShouldBeAfterLunch) {
      // Move movedBlock to immediately after lunch in the structural array
      const beforeLunch  = withoutMoved.filter(b => !b.isEndOfDay && !b.isLunch && !b.isWrap && withoutMoved.indexOf(b) < withoutMoved.findIndex(x => x.isLunch));
      const afterLunch   = withoutMoved.filter(b => !b.isEndOfDay && !b.isLunch && !b.isWrap && withoutMoved.indexOf(b) > withoutMoved.findIndex(x => x.isLunch));
      const lunchBlockFn = withoutMoved.find(b => b.isLunch);
      return [
        ...beforeLunch,
        ...(lunchBlockFn ? [lunchBlockFn] : []),
        movedBlock,
        ...afterLunch,
        ...(wrapBlock ? [wrapBlock] : []),
        ...(endOfDay ? [endOfDay] : []),
      ];
    } else {
      // Move movedBlock to immediately before lunch in the structural array
      const lunchBlockFn = withoutMoved.find(b => b.isLunch);
      const lunchPos = withoutMoved.findIndex(b => b.isLunch);
      const before = withoutMoved.slice(0, lunchPos).filter(b => !b.isEndOfDay && !b.isWrap);
      const after  = withoutMoved.slice(lunchPos + 1).filter(b => !b.isEndOfDay && !b.isWrap);
      return [
        ...before,
        movedBlock,
        ...(lunchBlockFn ? [lunchBlockFn] : []),
        ...after,
        ...(wrapBlock ? [wrapBlock] : []),
        ...(endOfDay ? [endOfDay] : []),
      ];
    }
  };

  const fillEmptyBlockTarget = (blocks, targetBlockId, blockToFill) => (
    blocks.map((block) => {
      if (block.id !== targetBlockId) return normalizeScheduleBlock(block);

      const targetBlock = { ...block };
      delete targetBlock.preserveEmpty;
      delete targetBlock.sceneId;
      delete targetBlock.sceneNumber;
      const nextBlock = {
        ...targetBlock,
        type: "scene",
        scene: blockToFill.scene ? normalizeSceneRef(blockToFill.scene) : null,
      };

      if (blockToFill.customItem) {
        nextBlock.customItem = blockToFill.customItem;
      } else {
        delete nextBlock.customItem;
      }

      return normalizeScheduleBlock(nextBlock);
    })
  );

  const createScheduledSceneBlock = (scene, targetBlock) => normalizeScheduleBlock({
    id: crypto.randomUUID(),
    scene: normalizeSceneRef(scene),
    time: targetBlock?.time || "8:00 AM",
    type: "scene",
  });

  const syncDayBlocks = (dayId, scheduleBlocks) => {
    syncLocks.current.shootingDays = true;
    return database
      .updateShootingDayScheduleBlocks(selectedProject, dayId, scheduleBlocks)
      .then(() => { syncLocks.current.shootingDays = false; })
      .catch((error) => { console.error("❌ Atomic schedule blocks update failed:", error); syncLocks.current.shootingDays = false; });
  };

  const handleDragStart = (e, scene, source, sourceDayId = null, sourceBlockId = null) => {
    setDraggedItem({ scene, source, sourceDayId, sourceBlockId });
    setDropIndicator(null);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropIndicator(null);
  };

  const handleDragOver = (e, dayId = null, blockId = null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dayId && blockId) {
      const day = shootingDays.find((shootingDay) => shootingDay.id === dayId);
      const block = day?.scheduleBlocks?.find((scheduleBlock) => scheduleBlock.id === blockId);
      const position = isEmptySceneBlockTarget(block) ? "fill" : getDropPosition(e);
      setDropIndicator((current) => (
        current?.dayId === dayId && current?.blockId === blockId && current?.position === position
          ? current
          : { dayId, blockId, position }
      ));
    }
  };

  const handleDrop = (e, dayId, blockId) => {
    e.preventDefault();
    if (!draggedItem) {
      setDropIndicator(null);
      return;
    }

    const updatedDays = [...shootingDays];
    const targetDayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (targetDayIndex === -1) { setDraggedItem(null); setDropIndicator(null); return; }

    const targetBlocks = updatedDays[targetDayIndex].scheduleBlocks;
    const targetBlockIndex = targetBlocks.findIndex((block) => block.id === blockId);
    if (targetBlockIndex === -1) { setDraggedItem(null); setDropIndicator(null); return; }

    const targetBlock = targetBlocks[targetBlockIndex];
    const dropPosition = getDropPosition(e);
    const isEmptyTarget = isEmptySceneBlockTarget(targetBlock);

    // Helper: extract the Scene Start Anchor for a day's blocks.
    // This is the first populated scene's stored start time — what the user has established
    // as the gap between Call Time and when shooting begins.
    // Captured BEFORE any structural reorder so drag/drop preserves it.
    const getSceneStartAnchor = (blocks, dcm) => {
      const sceneBlocks = (blocks || []).filter(b => !b.isEndOfDay && !b.isLunch && !b.isWrap);
      const firstPop = sceneBlocks.find(b => isPopulated(b));
      return parseTimeMins(firstPop?.time) ?? dcm;
    };

    if (draggedItem.source === "available") {
      // Capture Scene Start Anchor before structural change
      const dcm = getDayCallMins(updatedDays[targetDayIndex]);
      const sceneAnchor = getSceneStartAnchor(targetBlocks, dcm);

      const latestScene = normalizeSceneRef(
        stripboardScenes.find((s) => sameScene(s, draggedItem.scene)) ||
          draggedItem.scene
      );
      const insertedBlock = createScheduledSceneBlock(latestScene, targetBlock);

      // Resolve drop intent BEFORE insertion — same boundary logic as scheduled drops.
      const availDropIntent = !isEmptyTarget
        ? resolveDropIntentAroundLunch(targetBlock, dropPosition, targetBlocks, dcm)
        : "normal";

      const rawBlocks = isEmptyTarget
        ? fillEmptyBlockTarget(targetBlocks, blockId, insertedBlock)
        : availDropIntent === "postLunch"
          ? insertBlockPostLunch(targetBlocks, insertedBlock)
          : insertBlockAtTarget(targetBlocks, insertedBlock, blockId, dropPosition);

      // Safety net: resolveLunchAwareDropOrder for any remaining mismatches.
      const correctedRaw = !isEmptyTarget && availDropIntent !== "postLunch"
        ? resolveLunchAwareDropOrder(rawBlocks, insertedBlock.id, dcm, sceneAnchor)
        : rawBlocks;
      // Cascade from the pre-existing Scene Start Anchor — preserves deliberate first-scene gap
      const cascadedBlocks = recalculateDayScheduleBlocks(correctedRaw, { dayCallMins: dcm, sceneStartAnchorMins: sceneAnchor });
      updatedDays[targetDayIndex] = {
        ...updatedDays[targetDayIndex],
        scheduleBlocks: cascadedBlocks,
      };
      setShootingDays(updatedDays);

      // scheduledScenes status write is independent of schedule block timing —
      // keep it but do NOT sync scheduledScenes here; that is handled by onScheduleScene.
      onScheduleScene(
        stripboardScenes.findIndex((s) => sameScene(s, latestScene)),
        updatedDays[targetDayIndex].date,
        insertedBlock.time
      );

      syncDayBlocks(dayId, cascadedBlocks);

    } else if (draggedItem.source === "scheduled") {
      const sourceDayIndex = updatedDays.findIndex((day) => day.id === draggedItem.sourceDayId);
      if (sourceDayIndex === -1) { setDraggedItem(null); setDropIndicator(null); return; }

      const sourceBlocks = updatedDays[sourceDayIndex].scheduleBlocks;
      const sourceBlockIndex = sourceBlocks.findIndex((block) => block.id === draggedItem.sourceBlockId);
      if (sourceBlockIndex === -1) { setDraggedItem(null); setDropIndicator(null); return; }

      const sourceBlock = sourceBlocks[sourceBlockIndex];
      const movedBlock = normalizeScheduleBlock({ ...sourceBlock });
      const sourceLunchIndex = getLunchDividerIndex(sourceBlocks);
      const targetLunchIndex = sourceDayIndex === targetDayIndex
        ? sourceLunchIndex
        : getLunchDividerIndex(targetBlocks);
      const shouldPreserveLunch = !isLunchBlock(movedBlock);

      if (draggedItem.sourceDayId === dayId && draggedItem.sourceBlockId === blockId) {
        setDraggedItem(null);
        setDropIndicator(null);
        return;
      }

      // Capture Scene Start Anchors BEFORE any structural change.
      // Source anchor: first populated scene time on source day (preserved after scene removed).
      // Target anchor: first populated scene time on target day (preserved after scene inserted).
      // These anchors represent the deliberate gap between Call Time and first shot of the day.
      const sourceDcm = getDayCallMins(updatedDays[sourceDayIndex]);
      const targetDcm = getDayCallMins(updatedDays[targetDayIndex]);
      const sourceAnchor = getSceneStartAnchor(sourceBlocks, sourceDcm);
      const targetAnchor = sourceDayIndex === targetDayIndex
        ? sourceAnchor
        : getSceneStartAnchor(targetBlocks, targetDcm);

      const sceneToMove = movedBlock.scene;
      const sourceBlocksAfterRemoval = normalizeOrderedBlocks(
        sourceBlocks.filter((block) => block.id !== draggedItem.sourceBlockId)
      );
      const rawSourceBlocks = shouldPreserveLunch
        ? assembleBlocksWithLunchAtIndex(sourceBlocksAfterRemoval, sourceLunchIndex)
        : sourceBlocksAfterRemoval;
      // Cascade source day after removal — preserve its Scene Start Anchor
      // If source day now has no populated scenes, anchor defaults to call time (correct)
      const sourceAnchorAfterRemoval = getSceneStartAnchor(rawSourceBlocks, sourceDcm);
      updatedDays[sourceDayIndex] = {
        ...updatedDays[sourceDayIndex],
        scheduleBlocks: recalculateDayScheduleBlocks(rawSourceBlocks, {
          dayCallMins: sourceDcm,
          sceneStartAnchorMins: sourceAnchorAfterRemoval,
        }),
      };

      const nextTargetBlocks = sourceDayIndex === targetDayIndex
        ? updatedDays[targetDayIndex].scheduleBlocks
        : targetBlocks;

      // Resolve drop intent BEFORE structural insertion.
      // If the target scene's true wall-clock end is >= lunchMins and dropPosition === "after",
      // we must insert after lunch regardless of raw visual position.
      // This prevents the boundary case (Scene ends exactly at lunch start → drop inserts before it).
      const dropIntent = shouldPreserveLunch && !isLunchBlock(movedBlock) && !isEmptyTarget
        ? resolveDropIntentAroundLunch(targetBlock, dropPosition, nextTargetBlocks, targetDcm)
        : "normal";

      const rawTargetBlocks = isEmptyTarget && !isLunchBlock(movedBlock)
        ? fillEmptyBlockTarget(nextTargetBlocks, blockId, movedBlock)
        : dropIntent === "postLunch"
          ? insertBlockPostLunch(nextTargetBlocks, movedBlock)
          : (
              shouldPreserveLunch
                ? insertBlockAtTargetPreservingLunch(nextTargetBlocks, movedBlock, blockId, dropPosition, targetLunchIndex)
                : insertBlockAtTarget(nextTargetBlocks, movedBlock, blockId, dropPosition)
            );

      // Safety net: resolveLunchAwareDropOrder catches any remaining structural mismatches
      // after insertion (e.g. cross-day drops where timing context differs).
      const correctedTargetBlocks = shouldPreserveLunch && !isLunchBlock(movedBlock) && !isEmptyTarget && dropIntent !== "postLunch"
        ? resolveLunchAwareDropOrder(rawTargetBlocks, movedBlock.id, targetDcm, targetAnchor)
        : rawTargetBlocks;

      // Cascade target day after drop — use the pre-captured target Scene Start Anchor.
      // The moved scene's old time is NOT used as the cascade start.
      updatedDays[targetDayIndex] = {
        ...updatedDays[targetDayIndex],
        scheduleBlocks: recalculateDayScheduleBlocks(correctedTargetBlocks, {
          dayCallMins: targetDcm,
          sceneStartAnchorMins: targetAnchor,
        }),
      };

      if (sourceDayIndex !== targetDayIndex && sceneToMove && !sceneToMove.isLunch && !sceneToMove.isCustom) {
        const sourceDate = updatedDays[sourceDayIndex].date;
        const targetDate = updatedDays[targetDayIndex].date;
        const updatedStripboard = [...stripboardScenes];
        const movedSceneIndex = updatedStripboard.findIndex((s) => sameScene(s, sceneToMove));
        if (movedSceneIndex !== -1) {
          updatedStripboard[movedSceneIndex].scheduledDate = targetDate;
          setStripboardScenes(updatedStripboard);
        }
        const newScheduledScenes = { ...scheduledScenes };
        if (newScheduledScenes[sourceDate]) {
          newScheduledScenes[sourceDate] = newScheduledScenes[sourceDate].filter((scene) => !sameScene(scene, sceneToMove));
          if (newScheduledScenes[sourceDate].length === 0) delete newScheduledScenes[sourceDate];
        }
        if (!newScheduledScenes[targetDate]) newScheduledScenes[targetDate] = [];
        if (!newScheduledScenes[targetDate].some((scene) => sameScene(scene, sceneToMove))) {
          newScheduledScenes[targetDate].push(normalizeSceneRef(sceneToMove));
        }
        setScheduledScenes(newScheduledScenes);
        if (onSyncScheduledScenes) onSyncScheduledScenes(newScheduledScenes);
      }

      setShootingDays(updatedDays);

      // One atomic write per drop — never per-scene
      syncLocks.current.shootingDays = true;
      if (sourceDayIndex !== targetDayIndex) {
        database
          .updateTwoShootingDaySchedules(
            selectedProject,
            updatedDays[sourceDayIndex].id, updatedDays[sourceDayIndex].scheduleBlocks,
            updatedDays[targetDayIndex].id, updatedDays[targetDayIndex].scheduleBlocks
          )
          .then(() => { syncLocks.current.shootingDays = false; })
          .catch((error) => { console.error("❌ Atomic two-day update failed:", error); syncLocks.current.shootingDays = false; });
      } else {
        syncDayBlocks(dayId, updatedDays[targetDayIndex].scheduleBlocks);
      }
    }

    setDraggedItem(null);
    setDropIndicator(null);
  };

  const removeScene = (dayId, blockId) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const blocks = updatedDays[dayIndex].scheduleBlocks;
    const blockIndex = blocks.findIndex((block) => block.id === blockId);
    if (blockIndex === -1 || !blocks[blockIndex].scene) return;

    const scene = blocks[blockIndex].scene;
    const rawAfterRemoval = normalizeOrderedBlocks(blocks.filter((block) => block.id !== blockId));
    updatedDays[dayIndex] = {
      ...updatedDays[dayIndex],
      scheduleBlocks: recalculateDayScheduleBlocks(rawAfterRemoval, { dayCallMins: getDayCallMins(updatedDays[dayIndex]) }),
    };
    setShootingDays(updatedDays);

    const updatedStripboard = [...stripboardScenes];
    const stripboardIndex = updatedStripboard.findIndex(
      (s) => sameScene(s, scene)
    );

    if (stripboardIndex !== -1) {
      const originalStatus = updatedStripboard[stripboardIndex].status;
      const newStatus = originalStatus === "Scheduled" ? "Not Scheduled" : originalStatus;
      updatedStripboard[stripboardIndex] = { ...updatedStripboard[stripboardIndex], status: newStatus, scheduledDate: null, scheduledTime: null };
      setStripboardScenes(updatedStripboard);

      database
        .updateStripboardSceneSchedule(selectedProject, scene.sceneNumber.toString(), newStatus, null, null)
        .catch((error) => { console.error("❌ Atomic scene update failed:", error); alert("⚠️ Failed to update scene schedule. Please try again."); });
    }

    const updatedMainScenes = [...scenes];
    const mainSceneIndex = updatedMainScenes.findIndex(
      (s) => sameScene(s, scene)
    );
    if (mainSceneIndex !== -1) {
      const originalStatus = updatedMainScenes[mainSceneIndex].status;
      const newStatus = originalStatus === "Scheduled" ? "Not Scheduled" : originalStatus;
      updatedMainScenes[mainSceneIndex] = { ...updatedMainScenes[mainSceneIndex], status: newStatus };
      setScenes(updatedMainScenes);
      database
        .updateSceneStatus(selectedProject, scene.sceneNumber.toString(), newStatus)
        .catch((error) => { console.error("❌ Atomic scene status update failed:", error); });
    }

    // Hold shootingDays lock for the full duration of both writes so that the
    // scheduled_scenes realtime event (fired by onSyncScheduledScenes) cannot
    // trigger a stale shootingDays reload while our own write is still in flight.
    syncLocks.current.shootingDays = true;
    const dayDate = updatedDays[dayIndex].date;
    const newScheduledScenes = { ...scheduledScenes };
    if (newScheduledScenes[dayDate]) {
      newScheduledScenes[dayDate] = newScheduledScenes[dayDate].filter((s) => !sameScene(s, scene));
      if (newScheduledScenes[dayDate].length === 0) delete newScheduledScenes[dayDate];
      setScheduledScenes(newScheduledScenes);
    }
    Promise.all([
      database.updateShootingDayScheduleBlocks(selectedProject, dayId, updatedDays[dayIndex].scheduleBlocks),
      onSyncScheduledScenes ? onSyncScheduledScenes(newScheduledScenes) : Promise.resolve(),
    ])
      .then(() => { syncLocks.current.shootingDays = false; })
      .catch((error) => { console.error("❌ Remove scene write failed:", error); syncLocks.current.shootingDays = false; });
  };

  const removeBlock = (dayId, blockId) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const blocks = updatedDays[dayIndex].scheduleBlocks;
    const sceneBlocks = blocks.filter((block) => block.type === "scene");
    if (sceneBlocks.length <= 2) { alert("Must have at least 2 scene blocks per day"); return; }

    const blockIndex = blocks.findIndex((block) => block.id === blockId);
    if (blockIndex !== -1) {
      const blockToRemove = blocks[blockIndex];
      if (blockToRemove.scene && onUnscheduleScene) {
        const sceneIndex = stripboardScenes.findIndex((s) => sameScene(s, blockToRemove.scene));
        if (sceneIndex !== -1) onUnscheduleScene(sceneIndex);
      }
      const rawAfterRemoval = [...blocks.slice(0, blockIndex), ...blocks.slice(blockIndex + 1)];
      updatedDays[dayIndex] = {
        ...updatedDays[dayIndex],
        scheduleBlocks: recalculateDayScheduleBlocks(rawAfterRemoval, { dayCallMins: getDayCallMins(updatedDays[dayIndex]) }),
      };
      setShootingDays(updatedDays);
      syncDayBlocks(dayId, updatedDays[dayIndex].scheduleBlocks);
    }
  };

  const addBlock = (dayId) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const blocks = updatedDays[dayIndex].scheduleBlocks;
    const sceneBlocks = blocks.filter((block) => block.type === "scene");
    const lastSceneBlock = sceneBlocks[sceneBlocks.length - 1];

    let newTime = "8:00 AM";
    if (lastSceneBlock && lastSceneBlock.time) {
      const timeStr = lastSceneBlock.time;
      const [time, period] = timeStr.split(" ");
      const [hours, minutes] = time.split(":").map(Number);
      let newMinutes = minutes + 15;
      let newHours = hours;
      if (newMinutes >= 60) { newMinutes = 0; newHours += 1; }
      let newPeriod = period;
      if (newHours > 12) { newHours -= 12; newPeriod = period === "AM" ? "PM" : "AM"; }
      else if (newHours === 12 && period === "AM") newPeriod = "PM";
      newTime = `${newHours}:${newMinutes.toString().padStart(2, "0")} ${newPeriod}`;
    }

    const newBlock = {
      id: crypto.randomUUID(),
      scene: null,
      time: newTime,
      type: "scene",
      preserveEmpty: true,
    };
    const endOfDayIndex = blocks.findIndex((block) => block.isEndOfDay);
    if (endOfDayIndex !== -1) blocks.splice(endOfDayIndex, 0, newBlock);
    else blocks.push(newBlock);
    setShootingDays(updatedDays);
    syncDayBlocks(dayId, updatedDays[dayIndex].scheduleBlocks);
  };

  const updateBlockTime = (dayId, blockId, newTime, syncFunction) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const blocks = updatedDays[dayIndex].scheduleBlocks;
    const blockIndex = blocks.findIndex((block) => block.id === blockId);
    if (blockIndex === -1) return;

    blocks[blockIndex].time = newTime;
    setShootingDays(updatedDays);

    const changedDay = updatedDays[dayIndex];
    syncLocks.current.shootingDays = true;
    database
      .updateShootingDayScheduleBlocks(selectedProject, dayId, changedDay.scheduleBlocks)
      .then(() => { syncLocks.current.shootingDays = false; })
      .catch((error) => { console.error("❌ Atomic time change update failed:", error); syncLocks.current.shootingDays = false; });
  };

  const updateDayCollapse = (dayId, isCollapsed) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex !== -1) {
      updatedDays[dayIndex] = { ...updatedDays[dayIndex], isCollapsed };
      setShootingDays(updatedDays);
    }
  };

  const lockDayAndMarkShot = (dayId) => {
    lockQueue.current.push(dayId);
    if (lockTimeout.current) clearTimeout(lockTimeout.current);
    lockTimeout.current = setTimeout(() => { processBatchLock(); }, 500);
  };

  const processBatchLock = () => {
    if (lockQueue.current.length === 0) return;

    const daysToLock = [...lockQueue.current];
    lockQueue.current = [];

    const updatedDays = [...shootingDays];
    const allScenesUpdated = [];
    const allStripboardUpdated = [...stripboardScenes];

    daysToLock.forEach((dayId) => {
      const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
      if (dayIndex === -1) return;

      updatedDays[dayIndex] = { ...updatedDays[dayIndex], isLocked: true, isCollapsed: true, isShot: true };

      const scheduledScenesForDay = updatedDays[dayIndex].scheduleBlocks
        .filter((block) => block.scene && !block.scene.isLunch && !block.scene.isCustom)
        .map((block) => block.scene);

      allScenesUpdated.push(...scheduledScenesForDay);
    });

    allScenesUpdated.forEach((scene) => {
      const sceneIndex = allStripboardUpdated.findIndex(
        (s) => sameScene(s, scene)
      );
      if (sceneIndex !== -1) {
        allStripboardUpdated[sceneIndex] = { ...allStripboardUpdated[sceneIndex], status: "Shot", scheduledDate: null, scheduledTime: null };
      }
    });

    const updatedMainScenes = [...scenes];
    allScenesUpdated.forEach((scene) => {
      const mainSceneIndex = updatedMainScenes.findIndex((s) => sameScene(s, scene));
      if (mainSceneIndex !== -1) {
        updatedMainScenes[mainSceneIndex] = { ...updatedMainScenes[mainSceneIndex], status: "Shot" };
      }
    });

    setShootingDays(updatedDays);
    setStripboardScenes(allStripboardUpdated);
    setScenes(updatedMainScenes);

    const dayUpdates = daysToLock.map((dayId) => ({ dayId, isLocked: true, isShot: true, isCollapsed: true }));

    database
      .batchUpdateShootingDayStatuses(selectedProject, dayUpdates)
      .catch((error) => {
        console.error("❌ Atomic batch update failed:", error);
        alert("⚠️ Failed to save day lock status. Please try again.");
      });

    setTimeout(() => {
      const mainSceneUpdates = allScenesUpdated.map((scene) =>
        database.updateSceneStatus(selectedProject, scene.sceneNumber.toString(), "Shot")
      );
      Promise.all(mainSceneUpdates).catch((error) => { console.error("❌ Atomic main scenes batch update failed:", error); });

      const sceneUpdates = allScenesUpdated.map((scene) => ({
        scene_number: scene.sceneNumber.toString(),
        status: "Shot",
        scheduled_date: null,
        scheduled_time: null,
      }));

      database
        .batchUpdateStripboardSceneStatuses(selectedProject, sceneUpdates)
        .catch((error) => { console.error("❌ Atomic stripboard batch update failed:", error); alert("⚠️ Failed to save scene statuses. Please try again."); });
    }, 100);

    alert(`Batch locked ${daysToLock.length} days! ${allScenesUpdated.length} scenes marked as Shot.`);
  };

  const unlockDay = (dayId) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const day = updatedDays[dayIndex];
    const confirmUnlock = window.confirm(
      `Are you sure you want to unlock Day ${day.dayNumber}? This will change scene statuses back to "Scheduled".`
    );

    if (confirmUnlock) {
      const dayScenes = day.scheduleBlocks
        .filter((block) => block.scene && !block.scene.isLunch && !block.scene.isCustom)
        .map((block) => block.scene);

      const updatedStripboard = [...stripboardScenes];
      dayScenes.forEach((scene) => {
        const sceneIndex = updatedStripboard.findIndex(
          (s) => sameScene(s, scene)
        );
        if (sceneIndex !== -1) {
          updatedStripboard[sceneIndex] = { ...updatedStripboard[sceneIndex], status: "Scheduled", scheduledDate: day.date };
        }
      });
      setStripboardScenes(updatedStripboard);

      const sceneUpdates = dayScenes.map((scene) => ({
        scene_number: scene.sceneNumber.toString(),
        status: "Scheduled",
        scheduled_date: day.date,
        scheduled_time: null,
      }));

      database
        .batchUpdateStripboardSceneStatuses(selectedProject, sceneUpdates)
        .catch((error) => { console.error("❌ Atomic stripboard update failed:", error); alert("⚠️ Failed to update scene statuses. Please try again."); });

      const updatedMainScenes = [...scenes];
      dayScenes.forEach((scene) => {
        const mainSceneIndex = updatedMainScenes.findIndex(
          (s) => sameScene(s, scene)
        );
        if (mainSceneIndex !== -1) {
          updatedMainScenes[mainSceneIndex] = { ...updatedMainScenes[mainSceneIndex], status: "Scheduled" };
        }
      });
      setScenes(updatedMainScenes);

      const mainSceneUpdates = dayScenes.map((scene) =>
        database.updateSceneStatus(selectedProject, scene.sceneNumber.toString(), "Scheduled")
      );
      Promise.all(mainSceneUpdates).catch((error) => { console.error("❌ Atomic main scenes unlock failed:", error); });

      updatedDays[dayIndex] = { ...day, isLocked: false, isShot: false };
      setShootingDays(updatedDays);

      Promise.all([
        database.updateShootingDayLockStatus(selectedProject, dayId, false),
        database.updateShootingDayShotStatus(selectedProject, dayId, false),
      ]).catch((error) => { console.error("❌ Atomic unlock failed:", error); alert("⚠️ Failed to save unlock status. Please try again."); });

      alert(`Day ${day.dayNumber} unlocked! Scenes restored to Scheduled status.`);
    }
  };

  const resetSceneToUnscheduled = (sceneNumber) => {
    const confirmReset = window.confirm(
      `Reset Scene ${sceneNumber} to completely unscheduled state?\n\nThis will:\n- Set status to "Not Scheduled"\n- Clear scheduled date and time\n- Remove from all shooting days\n- Make scene available for scheduling again`
    );
    if (!confirmReset) return;

    const updatedStripboard = [...stripboardScenes];
    const stripboardIndex = updatedStripboard.findIndex(
      (s) => sameScene(s, sceneNumber)
    );
    if (stripboardIndex !== -1) {
      updatedStripboard[stripboardIndex] = { ...updatedStripboard[stripboardIndex], status: "Not Scheduled", scheduledDate: null, scheduledTime: null };
      setStripboardScenes(updatedStripboard);
      database
        .clearStripboardSceneSchedule(selectedProject, sceneNumber.toString())
        .catch((error) => { console.error("❌ Atomic scene reset failed:", error); alert("⚠️ Failed to reset scene. Please try again."); });
    }

    const updatedMainScenes = [...scenes];
    const mainSceneIndex = updatedMainScenes.findIndex((s) => sameScene(s, sceneNumber));
    if (mainSceneIndex !== -1) {
      updatedMainScenes[mainSceneIndex] = { ...updatedMainScenes[mainSceneIndex], status: "Not Scheduled" };
      setScenes(updatedMainScenes);
      if (saveScenesDatabase) saveScenesDatabase(updatedMainScenes);
    }

    const updatedDays = shootingDays.map((day) => ({
      ...day,
      scheduleBlocks: day.scheduleBlocks.map((block) => {
        if (block.scene && sameScene(block.scene, sceneNumber)) {
          return normalizeScheduleBlock({ ...block, scene: null });
        }
        return block;
      }),
    }));
    setShootingDays(updatedDays);
    if (onSyncAllShootingDays) onSyncAllShootingDays();

    const newScheduledScenes = { ...scheduledScenes };
    Object.keys(newScheduledScenes).forEach((date) => {
      newScheduledScenes[date] = newScheduledScenes[date].filter((s) => !sameScene(s, sceneNumber));
      if (newScheduledScenes[date].length === 0) delete newScheduledScenes[date];
    });
    setScheduledScenes(newScheduledScenes);
    if (onSyncScheduledScenes) onSyncScheduledScenes(newScheduledScenes);

    alert(`Scene ${sceneNumber} reset to unscheduled state.`);
  };

  const updateCustomItem = (dayId, blockId, customText) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const blocks = updatedDays[dayIndex].scheduleBlocks;
    const blockIndex = blocks.findIndex((block) => block.id === blockId);
    if (blockIndex !== -1) {
      if (customText) blocks[blockIndex].customItem = customText;
      else delete blocks[blockIndex].customItem;
      setShootingDays(updatedDays);
      syncDayBlocks(dayId, updatedDays[dayIndex].scheduleBlocks);
    }
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      setShowScriptPopup(false);
      setSelectedSceneForScript(null);
      setShowStatusDropdown(false);
      setShowLocationDropdown(false);
      setTimePopup(null);
      setCallTimePopup(null);
      setLunchTimePopup(null);
      setWrapPopup(null);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  const openTimePopup = (dayId, blockId, anchorRect) => {
    const day = shootingDays.find(d => d.id === dayId);
    if (!day) return;
    const block = (day.scheduleBlocks || []).find(b => b.id === blockId);
    if (!block) return;
    setTimePopup({ dayId, blockId, block, day, anchorRect, callTimeMins: getDayCallMins(day) });
  };

  const closeTimePopup = () => setTimePopup(null);

  // Resolve the call time string for a day.
  // Priority: day.callTime (in-session) > callSheetData.callTimeByDay > "8:00 AM" default.
  // NOTE: first-scene time is intentionally NOT a fallback here — it is independent of call time.
  const resolveDayCallTimeStr = (day) => {
    if (day.callTime) return day.callTime;
    if (callSheetData?.callTimeByDay?.[day.id]) return callSheetData.callTimeByDay[day.id];
    return "8:00 AM";
  };

  // Authoritative day-level call time in minutes. Always use this for:
  //   auto lunch start, wrap end, dayTimeline lunchMins, recalculate dayCallMins.
  // Never use first-scene time for these calculations.
  const getDayCallMins = (day) => parseTimeMins(resolveDayCallTimeStr(day)) ?? 8 * 60;

  const openCallTimePopup = (dayId, anchorRect) => {
    const day = shootingDays.find(d => d.id === dayId);
    if (!day) return;
    setCallTimePopup({ dayId, anchorRect, currentCallMins: getDayCallMins(day) });
  };

  const closeCallTimePopup = () => setCallTimePopup(null);

  // Cascade full day from new call time, persist schedule blocks once, sync call sheet.
  // Stores callTime on the day object in memory (runtime only — no new schema needed
  // because callTimeByDay already persists this through callSheetData).
  const commitCallTime = (dayId, newCallMins) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex(d => d.id === dayId);
    if (dayIndex === -1) return;
    const newCallTimeStr = fmtTimeMins(newCallMins);
    const newDayBlocks = recalculateDayScheduleBlocks(
      updatedDays[dayIndex].scheduleBlocks,
      { dayCallMins: newCallMins, cascadeFromCallTime: true }
    );
    // Store callTime on the day object in memory so the button display is independent of first scene block
    updatedDays[dayIndex] = { ...updatedDays[dayIndex], callTime: newCallTimeStr, scheduleBlocks: newDayBlocks };
    setShootingDays(updatedDays);
    syncLocks.current.shootingDays = true;
    database
      .updateShootingDayScheduleBlocks(selectedProject, dayId, newDayBlocks)
      .then(() => { syncLocks.current.shootingDays = false; })
      .catch((err) => { console.error("❌ Call time commit failed:", err); syncLocks.current.shootingDays = false; });
    // Persist through callSheetData.callTimeByDay — the only persistent path for day-level call time
    if (callSheetData && setCallSheetData && syncCallSheetData) {
      const newCallSheetData = {
        ...callSheetData,
        callTimeByDay: { ...callSheetData.callTimeByDay, [dayId]: newCallTimeStr },
      };
      setCallSheetData(newCallSheetData);
      syncCallSheetData(newCallSheetData);
    }
  };

  // Toggle Wrap block on/off for a day. Wrap block persists in schedule_blocks JSONB.
  const toggleWrap = (dayId, show) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex(d => d.id === dayId);
    if (dayIndex === -1) return;
    const day = updatedDays[dayIndex];
    const dcm = getDayCallMins(day);
    let blocks = day.scheduleBlocks || [];

    if (show) {
      if (!blocks.some(b => b.isWrap)) {
        const endOfDay = blocks.find(b => b.isEndOfDay);
        const wrapDur = 30;
        const dayEndMins = dcm + 12.5 * 60;
        const wrapStart = snap15(dayEndMins - wrapDur);
        const wrapBlock = {
          id: crypto.randomUUID(), isWrap: true, type: "wrap",
          time: fmtTimeMins(wrapStart), durationMinutes: wrapDur,
        };
        blocks = endOfDay
          ? [...blocks.filter(b => !b.isEndOfDay), wrapBlock, endOfDay]
          : [...blocks, wrapBlock];
      }
    } else {
      blocks = blocks.filter(b => !b.isWrap);
    }

    const newDayBlocks = recalculateDayScheduleBlocks(blocks, { dayCallMins: dcm });
    updatedDays[dayIndex] = { ...day, scheduleBlocks: newDayBlocks };
    setShootingDays(updatedDays);
    syncLocks.current.shootingDays = true;
    database
      .updateShootingDayScheduleBlocks(selectedProject, dayId, newDayBlocks)
      .then(() => { syncLocks.current.shootingDays = false; })
      .catch(err => { console.error("❌ Wrap toggle failed:", err); syncLocks.current.shootingDays = false; });
  };

  const openLunchPopup = (dayId, lunchBlock, anchorRect) => {
    const day = shootingDays.find(d => d.id === dayId);
    setLunchTimePopup({ dayId, lunchBlock, anchorRect, callTimeMins: day ? getDayCallMins(day) : 8 * 60 });
  };
  const closeLunchPopup = () => setLunchTimePopup(null);

  const openWrapPopup = (dayId, wrapBlock, anchorRect) => {
    const day = shootingDays.find(d => d.id === dayId);
    setWrapPopup({ dayId, wrapBlock, anchorRect, callTimeMins: day ? getDayCallMins(day) : 8 * 60 });
  };
  const closeWrapPopup = () => setWrapPopup(null);

  const commitWrap = ({ dayId, newDurationMins }) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex(d => d.id === dayId);
    if (dayIndex === -1) return;
    const dcm = getDayCallMins(updatedDays[dayIndex]);
    const updatedBlocks = updatedDays[dayIndex].scheduleBlocks.map(b =>
      b.isWrap ? { ...b, durationMinutes: newDurationMins } : b
    );
    const newDayBlocks = recalculateDayScheduleBlocks(updatedBlocks, { dayCallMins: dcm });
    updatedDays[dayIndex] = { ...updatedDays[dayIndex], scheduleBlocks: newDayBlocks };
    setShootingDays(updatedDays);
    syncLocks.current.shootingDays = true;
    database
      .updateShootingDayScheduleBlocks(selectedProject, dayId, newDayBlocks)
      .then(() => { syncLocks.current.shootingDays = false; })
      .catch(err => { console.error("❌ Wrap commit failed:", err); syncLocks.current.shootingDays = false; });
  };

  // Commit lunch edits: update lunch block time + durationMinutes + timingMode, then recascade.
  const commitLunch = ({ dayId, newLunchStartStr, newDurationMins, newTimingMode }) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex(d => d.id === dayId);
    if (dayIndex === -1) return;
    const dcm = getDayCallMins(updatedDays[dayIndex]);
    const updatedBlocks = updatedDays[dayIndex].scheduleBlocks.map(b => {
      if (!b.isLunch) return b;
      return { ...b, time: newLunchStartStr, durationMinutes: newDurationMins, timingMode: newTimingMode ?? "auto" };
    });
    const newDayBlocks = recalculateDayScheduleBlocks(updatedBlocks, { dayCallMins: dcm });
    updatedDays[dayIndex] = { ...updatedDays[dayIndex], scheduleBlocks: newDayBlocks };
    setShootingDays(updatedDays);
    syncLocks.current.shootingDays = true;
    database
      .updateShootingDayScheduleBlocks(selectedProject, dayId, newDayBlocks)
      .then(() => { syncLocks.current.shootingDays = false; })
      .catch((err) => { console.error("❌ Lunch commit failed:", err); syncLocks.current.shootingDays = false; });
  };

  // Handle popup commit: persist block time + optional duration + cascade day blocks
  const commitFromPopup = ({ dayId, blockId, newTimeStr, newDurStr, sceneRef, newDayBlocks, newCallTimeStr, prevSceneRef, prevSceneNewDurStr }) => {
    // 1. Persist all block times for the day
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex(d => d.id === dayId);
    if (dayIndex !== -1) {
      updatedDays[dayIndex] = { ...updatedDays[dayIndex], scheduleBlocks: newDayBlocks };
      setShootingDays(updatedDays);
      syncLocks.current.shootingDays = true;
      database
        .updateShootingDayScheduleBlocks(selectedProject, dayId, newDayBlocks)
        .then(() => { syncLocks.current.shootingDays = false; })
        .catch((err) => { console.error("❌ Time popup commit failed:", err); syncLocks.current.shootingDays = false; });
    }

    // 2. Persist the selected scene's duration change if applicable
    if (newDurStr && sceneRef) {
      const updatedScenes = scenes.map(s =>
        sameScene(s, sceneRef) ? { ...s, estimatedDuration: newDurStr } : s
      );
      const updatedStrip = stripboardScenes.map(s =>
        sameScene(s, sceneRef) ? { ...s, estimatedDuration: newDurStr } : s
      );
      setScenes(updatedScenes);
      setStripboardScenes(updatedStrip);
      if (saveScenesDatabase) saveScenesDatabase(updatedScenes);
    }

    // 2b. If conflict resolution shortened the previous scene, persist that too
    if (prevSceneRef && prevSceneNewDurStr) {
      const updatedScenes = (newDurStr && sceneRef ? scenes.map(s =>
        sameScene(s, sceneRef) ? { ...s, estimatedDuration: newDurStr } : s
      ) : scenes).map(s =>
        sameScene(s, prevSceneRef) ? { ...s, estimatedDuration: prevSceneNewDurStr } : s
      );
      const updatedStrip = (newDurStr && sceneRef ? stripboardScenes.map(s =>
        sameScene(s, sceneRef) ? { ...s, estimatedDuration: newDurStr } : s
      ) : stripboardScenes).map(s =>
        sameScene(s, prevSceneRef) ? { ...s, estimatedDuration: prevSceneNewDurStr } : s
      );
      setScenes(updatedScenes);
      setStripboardScenes(updatedStrip);
      if (saveScenesDatabase) saveScenesDatabase(updatedScenes);
    }

    // 3. Sync call time to Call Sheet if changed
    if (newCallTimeStr && callSheetData && setCallSheetData && syncCallSheetData) {
      const newCallSheetData = {
        ...callSheetData,
        callTimeByDay: { ...callSheetData.callTimeByDay, [dayId]: newCallTimeStr },
      };
      setCallSheetData(newCallSheetData);
      syncCallSheetData(newCallSheetData);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      {/* ── Header bar ── */}
      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid #eee", backgroundColor: "white" }}>
        <div style={{ flex: 1, display: "flex", minHeight: "38px", boxSizing: "border-box" }}>
          <div style={{ flex: 1, display: "flex", gap: "8px", alignItems: "center", padding: "5px 12px", boxSizing: "border-box" }}>
            <h2 style={{ margin: 0, fontSize: "17px", letterSpacing: "0.08em", fontWeight: "bold" }}>STRIPBOARD SCHEDULE</h2>
          </div>
        </div>
      </div>
      {/* ── Content area ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: "15px", width: "100%", boxSizing: "border-box", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>
        {/* Available Scenes Panel */}
        <div style={{ width: "300px", border: "1px solid #ccc", height: "100%", overflow: "hidden", flexShrink: 0, zIndex: 100, backgroundColor: "white", display: "flex", flexDirection: "column" }}>
          <div style={{ backgroundColor: "#4CAF50", color: "white", padding: "10px", fontWeight: "bold", textAlign: "center" }}>
            <div style={{ marginBottom: "8px" }}>Available Scenes ({availableScenes.length})</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
              {/* Status Filter */}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  style={{ backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "4px 8px", borderRadius: "3px", fontSize: "10px", cursor: "pointer" }}>
                  Status ({selectedStatuses.length})
                </button>
                {showStatusDropdown && (
                  <div style={{ position: "absolute", top: "100%", left: 0, backgroundColor: "white", border: "1px solid #ccc", borderRadius: "3px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", zIndex: 1000, minWidth: "150px", color: "black" }}>
                    {statusOptions.map((status) => (
                      <label key={status} style={{ display: "flex", alignItems: "center", padding: "4px 8px", fontSize: "10px", cursor: "pointer" }}>
                        <input type="checkbox" checked={selectedStatuses.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedStatuses([...selectedStatuses, status]);
                            else setSelectedStatuses(selectedStatuses.filter((s) => s !== status));
                          }}
                          style={{ marginRight: "4px" }} />
                        {status}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Location Filter */}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                  style={{ backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "4px 8px", borderRadius: "3px", fontSize: "10px", cursor: "pointer" }}>
                  Location {selectedParentLocation ? `(${selectedParentLocation})` : ""}
                </button>
                {showLocationDropdown && (
                  <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", backgroundColor: "white", border: "1px solid #ccc", borderRadius: "3px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", zIndex: 1000, width: "280px", color: "black", maxHeight: "300px", overflowY: "auto" }}>
                    <div style={{ padding: "4px 8px", borderBottom: "1px solid #eee" }}>
                      <button onClick={() => { setSelectedParentLocation(""); setSelectedSubLocations([]); }}
                        style={{ backgroundColor: "transparent", border: "none", fontSize: "10px", cursor: "pointer", color: selectedParentLocation ? "black" : "blue" }}>
                        All Locations
                      </button>
                    </div>
                    {Object.keys(locationHierarchy).map((parent) => (
                      <div key={parent}>
                        <div style={{ padding: "4px 8px", fontSize: "10px", fontWeight: "bold", backgroundColor: selectedParentLocation === parent ? "#e3f2fd" : "transparent", cursor: "pointer" }}
                          onClick={() => {
                            if (selectedParentLocation === parent) { setSelectedParentLocation(""); setSelectedSubLocations([]); }
                            else handleParentLocationChange(parent);
                          }}>
                          📍 {parent}
                        </div>
                        {selectedParentLocation === parent && (
                          <div style={{ paddingLeft: "16px", backgroundColor: "#f9f9f9" }}>
                            <div style={{ padding: "2px 4px" }}>
                              <button onClick={handleSelectAllSubLocations}
                                style={{ backgroundColor: "transparent", border: "1px solid #ccc", fontSize: "9px", cursor: "pointer", padding: "2px 4px", marginBottom: "4px" }}>
                                Select All
                              </button>
                            </div>
                            {locationHierarchy[parent].map((sub) => (
                              <label key={sub} style={{ display: "flex", alignItems: "center", padding: "2px 4px", fontSize: "9px", cursor: "pointer" }}>
                                <input type="checkbox" checked={selectedSubLocations.includes(sub)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedSubLocations([...selectedSubLocations, sub]);
                                    else setSelectedSubLocations(selectedSubLocations.filter((s) => s !== sub));
                                  }}
                                  style={{ marginRight: "4px" }} />
                                {sub}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => { setSelectedStatuses(["Not Scheduled"]); setSelectedParentLocation(""); setSelectedSubLocations([]); }}
                style={{ backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "4px 8px", borderRadius: "3px", fontSize: "10px", cursor: "pointer" }}>
                Clear
              </button>
            </div>
          </div>

          {showLocationDropdown && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 999 }} onClick={() => setShowLocationDropdown(false)} />
          )}
          {showStatusDropdown && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 999 }} onClick={() => setShowStatusDropdown(false)} />
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
            {availableScenes.map((scene, index) => {
              const isScheduled = !!scene.scheduledDate;
              return (
                <div key={scene.id || `${scene.sceneNumber}-${index}`} style={{ padding: "8px", margin: "4px 0", backgroundColor: isScheduled ? "#e0e0e0" : getStatusColor(scene.status || "Not Scheduled"), border: "1px solid #ddd", borderLeft: !isScheduled && Boolean(scene.metadata?.replacementLetter) ? `3px solid ${INSERTED_BORDER_COLOR}` : "1px solid #ddd", borderRadius: "4px", fontSize: "12px", opacity: isScheduled ? 0.6 : 1, position: "relative" }}>
                  <div draggable={!isScheduled} onDragStart={(e) => !isScheduled && handleDragStart(e, scene, "available")}
                    onDragEnd={handleDragEnd}
                    onDoubleClick={() => handleSceneDoubleClick(scene)} title="Double-click to view script"
                    style={{ cursor: isScheduled ? "not-allowed" : "grab", color: isScheduled ? "#666" : getStatusTextColor(scene.status || "Not Scheduled") }}>
                    <div style={{ fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Scene {getSceneDisplayLabel(scene, displayLabelMap)}: {scene.metadata?.intExt || ""} - {scene.metadata?.location || ""}</span>
                      {isScheduled && (
                        <button onClick={(e) => { e.stopPropagation(); resetSceneToUnscheduled(scene.sceneNumber); }}
                          title="Reset scene to unscheduled"
                          style={{ backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "2px", cursor: "pointer", fontSize: "10px", padding: "2px 6px", marginLeft: "4px" }}>
                          Reset
                        </button>
                      )}
                    </div>
                    <div style={{ color: isScheduled ? "#888" : "#666" }}>
                      {scene.metadata?.timeOfDay} | {scene.estimatedDuration}
                      {isScheduled && <span style={{ fontSize: "10px", marginLeft: "8px" }}>(Scheduled)</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Blocks Container */}
        <div ref={scrollContainerRef} onScroll={handleScroll}
          style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
          {shootingDays.map((day) => (
            <DayBlock
              key={day.id}
              day={day}
              timeOptions={timeOptions}
              onDrop={handleDrop}
              handleDragOver={handleDragOver}
              handleDragStart={handleDragStart}
              handleDragEnd={handleDragEnd}
              removeScene={removeScene}
              removeBlock={removeBlock}
              addBlock={addBlock}
              updateShootingDayDate={updateShootingDayDate}
              removeShootingDay={removeShootingDay}
              updateBlockTime={updateBlockTime}
              syncShootingDays={syncShootingDays}
              updateCustomItem={updateCustomItem}
              lockDayAndMarkShot={lockDayAndMarkShot}
              unlockDay={unlockDay}
              getSceneBlockColor={getSceneBlockColor}
              getSceneBlockTextColor={getSceneBlockTextColor}
              displayLabelMap={displayLabelMap}
              updateDayCollapse={updateDayCollapse}
              handleSceneDoubleClick={handleSceneDoubleClick}
              dropIndicator={dropIndicator}
              canEdit={canEdit}
              onOpenTimePopup={openTimePopup}
              activePopupBlockId={timePopup?.blockId ?? null}
              dayTimeline={buildDayTimeline(day.scheduleBlocks, getDayCallMins(day))}
              onOpenCallTimePopup={openCallTimePopup}
              activeCallTimeDayId={callTimePopup?.dayId ?? null}
              dayCallTimeStr={resolveDayCallTimeStr(day)}
              onOpenLunchPopup={openLunchPopup}
              activeLunchBlockId={lunchTimePopup?.lunchBlock?.id ?? null}
              onToggleWrap={toggleWrap}
              onOpenWrapPopup={openWrapPopup}
            />
          ))}

          <div style={{ backgroundColor: "#f5f5f5", padding: "20px", textAlign: "center", borderTop: "2px solid #ddd", marginTop: "20px" }}>
            <button onClick={addShootingDay}
              style={{ backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", padding: "12px 24px", fontSize: "14px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              + Add Shooting Day {shootingDays.length + 1}
            </button>
          </div>
        </div>

        {/* Script Popup Modal */}
        {showScriptPopup && selectedSceneForScript && (() => {
          const activeScene = scriptFullMode ? scenes[scriptFullIndex] || selectedSceneForScript : selectedSceneForScript;
          return (
            <>
              <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={closeScriptPopup}>
                <div style={{ backgroundColor: "white", width: "90%", maxWidth: "9.28in", height: "85%", borderRadius: "8px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ backgroundColor: "#2196F3", color: "white", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {scriptFullMode && (
                        <button onClick={() => setScriptFullIndex(Math.max(0, scriptFullIndex - 1))} disabled={scriptFullIndex === 0}
                          style={{ backgroundColor: scriptFullIndex === 0 ? "#ccc" : "white", color: scriptFullIndex === 0 ? "#888" : "#2196F3", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: scriptFullIndex === 0 ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                          ← Prev
                        </button>
                      )}
                      <h3 style={{ margin: 0, fontSize: "16px" }}>
                        Scene {getSceneDisplayLabel(activeScene, displayLabelMap)}
                        {scriptFullMode && ` (${scriptFullIndex + 1} of ${scenes.length})`}
                        {" - "}{activeScene.heading}
                      </h3>
                      {scriptFullMode && (
                        <button onClick={() => setScriptFullIndex(Math.min(scenes.length - 1, scriptFullIndex + 1))} disabled={scriptFullIndex === scenes.length - 1}
                          style={{ backgroundColor: scriptFullIndex === scenes.length - 1 ? "#ccc" : "white", color: scriptFullIndex === scenes.length - 1 ? "#888" : "#2196F3", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: scriptFullIndex === scenes.length - 1 ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                          Next →
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", userSelect: "none", color: "white" }}>
                        <input type="checkbox" checked={scriptFullMode}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const fi = (scenes || []).findIndex((s) => String(s.sceneNumber) === String(selectedSceneForScript.sceneNumber));
                              setScriptFullIndex(fi >= 0 ? fi : 0);
                            }
                            setScriptFullMode(e.target.checked);
                          }}
                          style={{ cursor: "pointer", accentColor: "white" }} />
                        Full Script
                      </label>
                      <button onClick={closeScriptPopup} style={{ backgroundColor: "transparent", border: "none", color: "white", fontSize: "24px", cursor: "pointer", padding: "0 5px" }}>×</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: "1.5in", overflow: "auto", backgroundColor: getSceneStatusColor(activeScene.sceneNumber), boxSizing: "border-box", textAlign: "left", fontFamily: "Courier New, monospace" }}>
                    <div style={getScheduleElementStyle("Scene Heading")}>{activeScene.heading}</div>
                    {activeScene.content && activeScene.content.map((block, blockIndex) => (
                      <div key={blockIndex} style={getScheduleElementStyle(block.type)}>{formatScheduleElementText(block)}</div>
                    ))}
                    {!activeScene.content && <div style={getScheduleElementStyle("Action")}>{activeScene.text || "Scene content not available"}</div>}
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {/* Scene Time Popup — position:fixed so it escapes overflow:hidden */}
        {timePopup && (
          <SceneTimePopup
            anchorRect={timePopup.anchorRect}
            popupData={timePopup}
            onCommit={commitFromPopup}
            onClose={closeTimePopup}
            displayLabelMap={displayLabelMap}
            canEdit={canEdit}
          />
        )}

        {/* Call Time Popup — position:fixed, opened from day header */}
        {callTimePopup && (
          <CallTimePopup
            anchorRect={callTimePopup.anchorRect}
            dayId={callTimePopup.dayId}
            currentCallMins={callTimePopup.currentCallMins}
            onCommit={commitCallTime}
            onClose={closeCallTimePopup}
            canEdit={canEdit}
          />
        )}

        {/* Lunch Time Popup — position:fixed, opened from lunch block time button */}
        {lunchTimePopup && (
          <LunchTimePopup
            anchorRect={lunchTimePopup.anchorRect}
            dayId={lunchTimePopup.dayId}
            lunchBlock={lunchTimePopup.lunchBlock}
            callTimeMins={lunchTimePopup.callTimeMins}
            onCommit={commitLunch}
            onClose={closeLunchPopup}
            canEdit={canEdit}
          />
        )}

        {/* Wrap Popup — position:fixed, opened from wrap block start button */}
        {wrapPopup && (
          <WrapPopup
            anchorRect={wrapPopup.anchorRect}
            dayId={wrapPopup.dayId}
            wrapBlock={wrapPopup.wrapBlock}
            callTimeMins={wrapPopup.callTimeMins}
            onCommit={commitWrap}
            onClose={closeWrapPopup}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}

export default StripboardScheduleModule;
