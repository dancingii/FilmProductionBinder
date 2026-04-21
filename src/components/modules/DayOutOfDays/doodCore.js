/**
 * DOOD Core Functions
 * Pure functions for Day Out of Days business logic
 * No side effects, easy to test
 */

// ============================================================================
// TIMEZONE-SAFE DATE PARSING
// ============================================================================

/**
 * Parse YYYY-MM-DD string as local date (not UTC)
 * Prevents timezone conversion bugs where "2026-02-15" becomes Feb 14 in PST
 * @param {string} dateStr - YYYY-MM-DD format
 * @returns {Date} Date object at midnight local time
 */
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Day code constants
const DayCodes = {
  SW: "SW",
  W: "W",
  WF: "WF",
  SWF: "SWF",
  H: "H",
  R: "R",
  F: "F",
  T: "T",
  RT: "RT",
  P: "P",
  O: "O",
  D: "D",
  BLANK: "",
};

const EventTypes = {
  WORK: "work",
  REHEARSAL: "rehearsal",
  FITTING: "fitting",
  TRAVEL: "travel",
  RETURN_TRAVEL: "return_travel",
  HOLD: "hold",
  PICKUP: "pickup",
  OFF: "off",
};

// ============================================================================
// CALENDAR GENERATION
// ============================================================================

/**
 * Generate array of calendar days from start to end date
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Array} Array of calendar day objects
 */
export function generateCalendarDays(startDate, endDate) {
  const days = [];
  const current = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  let dayNumber = 1;

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    const dayOfWeek = current.toLocaleDateString("en-US", { weekday: "long" });
    const isWeekend = current.getDay() === 0 || current.getDay() === 6;

    days.push({
      date: dateStr,
      dayOfWeek,
      dayNumber,
      dayType: isWeekend ? "weekend" : "shoot", // Default assumption
      isWeekend,
    });

    current.setDate(current.getDate() + 1);
    dayNumber++;
  }

  return days;
}

/**
 * Get array of dates between start and end (inclusive)
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Array<string>} Array of YYYY-MM-DD strings
 */
export function getDateRange(startDate, endDate) {
  const dates = [];
  const current = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// ============================================================================
// EVENT EXPANSION
// ============================================================================

/**
 * Expand a cast event into array of dates
 * @param {Object} event - Cast event with startDate and endDate
 * @returns {Array<string>} Array of dates this event covers
 */
export function expandCastEventToDates(event) {
  return getDateRange(event.startDate, event.endDate);
}

/**
 * Group consecutive dates into spans
 * @param {Array<string>} dates - Array of YYYY-MM-DD strings
 * @returns {Array<Object>} Array of {startDate, endDate} spans
 */
export function groupConsecutiveDates(dates) {
  if (dates.length === 0) return [];

  const sortedDates = [...dates].sort();
  const spans = [];
  let currentStart = sortedDates[0];
  let currentEnd = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = parseLocalDate(sortedDates[i - 1]);
    const currDate = parseLocalDate(sortedDates[i]);

    // Check if consecutive (1 day apart)
    const dayDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);

    if (dayDiff === 1) {
      // Extend current span
      currentEnd = sortedDates[i];
    } else {
      // Save current span and start new one
      spans.push({ startDate: currentStart, endDate: currentEnd });
      currentStart = sortedDates[i];
      currentEnd = sortedDates[i];
    }
  }

  // Save final span
  spans.push({ startDate: currentStart, endDate: currentEnd });

  return spans;
}

// ============================================================================
// DAY CODE GENERATION
// ============================================================================

/**
 * Generate day codes for a work event span
 * Work spans use SW/W/WF/SWF pattern
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Object} Map of date -> day code
 */
export function generateWorkCodes(startDate, endDate) {
  const dates = getDateRange(startDate, endDate);
  const codes = {};

  if (dates.length === 1) {
    // Single day = SWF (Start-Work-Finish)
    codes[dates[0]] = DayCodes.SWF;
  } else if (dates.length === 2) {
    // Two days = SW, WF
    codes[dates[0]] = DayCodes.SW;
    codes[dates[1]] = DayCodes.WF;
  } else {
    // Three or more days = SW, W, W, ..., WF
    codes[dates[0]] = DayCodes.SW;
    for (let i = 1; i < dates.length - 1; i++) {
      codes[dates[i]] = DayCodes.W;
    }
    codes[dates[dates.length - 1]] = DayCodes.WF;
  }

  return codes;
}

/**
 * Generate day codes for a single cast event
 * @param {Object} event - Cast event object
 * @returns {Object} Map of date -> day code
 */
export function generateCodesForEvent(event) {
  const dates = getDateRange(event.startDate, event.endDate);
  const codes = {};

  // Map event type to day code
  const codeMap = {
    [EventTypes.WORK]: null, // Work uses special SW/W/WF logic
    [EventTypes.REHEARSAL]: DayCodes.R,
    [EventTypes.FITTING]: DayCodes.F,
    [EventTypes.TRAVEL]: DayCodes.T,
    [EventTypes.RETURN_TRAVEL]: DayCodes.RT,
    [EventTypes.HOLD]: DayCodes.H,
    [EventTypes.PICKUP]: DayCodes.P,
    [EventTypes.OFF]: DayCodes.O,
  };

  if (event.eventType === EventTypes.WORK) {
    // Work events use SW/W/WF/SWF pattern
    return generateWorkCodes(event.startDate, event.endDate);
  } else {
    // Other events: all dates get same code
    const code = codeMap[event.eventType] || "";
    dates.forEach((date) => {
      codes[date] = code;
    });
  }

  return codes;
}

// ============================================================================
// MATRIX GENERATION
// ============================================================================

/**
 * Generate DOOD matrix from events and overrides
 * @param {Object} params
 * @param {Array} params.calendarDays - Calendar days array
 * @param {Array} params.castMembers - Cast members array
 * @param {Array} params.castEvents - Cast events array
 * @param {Array} params.overrides - Day code overrides array
 * @param {Object} params.settings - DOOD settings
 * @returns {Array} Array of DoodCell objects
 */
export function generateDoodMatrix({
  calendarDays,
  castMembers,
  castEvents,
  overrides = [],
  settings = {},
}) {
  const cells = [];

  // Build override lookup map for quick access
  const overrideMap = {};
  overrides.forEach((override) => {
    const key = `${override.castMemberId}_${override.date}`;
    overrideMap[key] = override;
  });

  // For each cast member
  castMembers.forEach((castMember) => {
    // Get all events for this cast member
    const memberEvents = castEvents.filter(
      (e) => e.castMemberId === castMember.castMemberId
    );

    // Build code map for all dates
    const autoCodeMap = {};

    memberEvents.forEach((event) => {
      const eventCodes = generateCodesForEvent(event);
      Object.entries(eventCodes).forEach(([date, code]) => {
        // If multiple events on same date, precedence rules would go here
        // For Phase 1, last event wins (simple)
        autoCodeMap[date] = {
          code,
          eventId: event.id,
        };
      });
    });

    // For each calendar day, create a cell
    calendarDays.forEach((day) => {
      const overrideKey = `${castMember.castMemberId}_${day.date}`;
      const override = overrideMap[overrideKey];
      const autoInfo = autoCodeMap[day.date];

      const autoCode = autoInfo?.code || "";
      const finalCode = override ? override.dayCode : autoCode;

      cells.push({
        castMemberId: castMember.castMemberId,
        date: day.date,
        autoCode,
        finalCode,
        sourceEventId: autoInfo?.eventId || null,
        overridden: !!override,
        note: override?.reason || "",
      });
    });
  });

  return cells;
}

// ============================================================================
// TOTALS CALCULATION
// ============================================================================

/**
 * Calculate totals for each cast member
 * @param {Array} cells - DOOD matrix cells
 * @param {Array} castMembers - Cast members array
 * @returns {Array} Array of totals objects
 */
export function calculateDoodTotals(cells, castMembers) {
  const totals = [];

  castMembers.forEach((castMember) => {
    const memberCells = cells.filter(
      (c) => c.castMemberId === castMember.castMemberId
    );

    let workDays = 0;
    let holdDays = 0;
    let rehearsalDays = 0;
    let fittingDays = 0;
    let travelDays = 0;
    let pickupDays = 0;
    let offDays = 0;

    const engagedDates = [];

    memberCells.forEach((cell) => {
      const code = cell.finalCode;

      // Count by day code
      if ([DayCodes.SW, DayCodes.W, DayCodes.WF, DayCodes.SWF].includes(code)) {
        workDays++;
        engagedDates.push(cell.date);
      } else if (code === DayCodes.H) {
        holdDays++;
        engagedDates.push(cell.date);
      } else if (code === DayCodes.R) {
        rehearsalDays++;
        engagedDates.push(cell.date);
      } else if (code === DayCodes.F) {
        fittingDays++;
        engagedDates.push(cell.date);
      } else if ([DayCodes.T, DayCodes.RT].includes(code)) {
        travelDays++;
        engagedDates.push(cell.date);
      } else if (code === DayCodes.P) {
        pickupDays++;
        engagedDates.push(cell.date);
      } else if (code === DayCodes.O) {
        offDays++;
        // Off days typically don't count as engaged
      }
    });

    engagedDates.sort();

    totals.push({
      castMemberId: castMember.castMemberId,
      workDays,
      holdDays,
      rehearsalDays,
      fittingDays,
      travelDays,
      pickupDays,
      offDays,
      totalEngagedDays: engagedDates.length,
      firstEngagedDate: engagedDates[0] || null,
      lastEngagedDate: engagedDates[engagedDates.length - 1] || null,
    });
  });

  return totals;
}

// ============================================================================
// REPORT VIEW BUILDER
// ============================================================================

/**
 * Build complete DOOD report view
 * @param {Object} params
 * @param {Object} params.production - Production info
 * @param {Array} params.calendarDays - Calendar days
 * @param {Array} params.castMembers - Cast members
 * @param {Array} params.cells - DOOD matrix cells
 * @param {Array} params.totals - Cast totals
 * @returns {Object} Complete DOOD report view
 */
export function buildDoodReportView({
  production,
  calendarDays,
  castMembers,
  cells,
  totals,
}) {
  const dates = calendarDays.map((d) => d.date);

  const rows = castMembers.map((castMember) => {
    const memberCells = cells.filter(
      (c) => c.castMemberId === castMember.castMemberId
    );

    const memberTotals = totals.find(
      (t) => t.castMemberId === castMember.castMemberId
    );

    // Build cells array in date order
    const cellsData = dates.map((date) => {
      const cell = memberCells.find((c) => c.date === date);
      return {
        date,
        code: cell?.finalCode || "",
      };
    });

    return {
      castMemberId: castMember.castMemberId,
      castNumber: castMember.castNumber || "",
      characterName: castMember.characterName || "",
      performerName: castMember.castMemberName || "",
      cells: cellsData,
      totals: memberTotals || {},
    };
  });

  return {
    productionTitle: production.title,
    startDate: production.startDate,
    endDate: production.endDate,
    dates,
    rows,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format date for display
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} Formatted date
 */
export function formatDate(dateStr) {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format date with day of week
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} Formatted date with day
 */
export function formatDateWithDay(dateStr) {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Check if date is weekend
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {boolean} True if weekend
 */
export function isWeekend(dateStr) {
  const date = parseLocalDate(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Calculate span length in days
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {number} Number of days (inclusive)
 */
export function getSpanLength(startDate, endDate) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const diffTime = end - start;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Inclusive
}
