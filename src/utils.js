// Film Production App - Utility Functions
// Extracted from App.js for better code organization
import React from "react";

const stemWord = (word) => {
  // Simple English stemming rules for common plurals and variations
  const stemmingRules = [
    // Irregular plurals (handle these first)
    { pattern: /^children$/, stem: "child" },
    { pattern: /^people$/, stem: "person" },
    { pattern: /^men$/, stem: "man" },
    { pattern: /^women$/, stem: "woman" },
    { pattern: /^feet$/, stem: "foot" },
    { pattern: /^teeth$/, stem: "tooth" },
    { pattern: /^geese$/, stem: "goose" },
    { pattern: /^mice$/, stem: "mouse" },

    // -ies endings (ladies -> lady, stories -> story)
    { pattern: /ies$/, stem: (word) => word.slice(0, -3) + "y" },

    // -ves endings (knives -> knife, wolves -> wolf)
    { pattern: /ves$/, stem: (word) => word.slice(0, -3) + "f" },

    // -es endings (boxes -> box, glasses -> glass)
    { pattern: /(s|x|z|ch|sh)es$/, stem: (word) => word.slice(0, -2) },

    // Regular -s plurals (cars -> car, dogs -> dog)
    { pattern: /s$/, stem: (word) => word.slice(0, -1) },

    // -ing endings (running -> run, walking -> walk)
    {
      pattern: /ing$/,
      stem: (word) => {
        const base = word.slice(0, -3);
        // Handle doubled consonants (running -> run, not runn)
        if (
          base.length >= 2 &&
          base[base.length - 1] === base[base.length - 2]
        ) {
          return base.slice(0, -1);
        }
        return base;
      },
    },

    // -ed endings (walked -> walk, moved -> move)
    {
      pattern: /ed$/,
      stem: (word) => {
        const base = word.slice(0, -2);
        // Handle doubled consonants (stopped -> stop, not stopp)
        if (
          base.length >= 2 &&
          base[base.length - 1] === base[base.length - 2]
        ) {
          return base.slice(0, -1);
        }
        return base;
      },
    },
  ];

  // Apply stemming rules in order
  for (const rule of stemmingRules) {
    if (typeof rule.stem === "string") {
      // Direct replacement for irregular words
      if (rule.pattern.test(word)) {
        return rule.stem;
      }
    } else {
      // Function-based stemming
      if (rule.pattern.test(word)) {
        return rule.stem(word);
      }
    }
  }

  // If no rules match, return the original word
  return word;
};

// Accurate DOM-based page calculations
const LINES_PER_PAGE = 65; // Single source for all page calculations
const LINE_HEIGHT_PT = 12;
const sceneMeasurements = new Map(); // Cache measurements

const measureSceneInDOM = (sceneIndex, scenes) => {
  const sceneContainer = document.querySelector(
    `[data-scene-index="${sceneIndex}"]`
  );
  if (!sceneContainer) return null;

  const sceneHeight = sceneContainer.offsetHeight;
  const linesInScene = Math.round(sceneHeight / LINE_HEIGHT_PT);

  // Cache the measurement
  sceneMeasurements.set(sceneIndex, {
    lines: linesInScene,
    measuredAt: Date.now(),
  });

  return linesInScene;
};

const calculateScenePageStats = (
  sceneIndex,
  scenes,
  totalScriptPages = 107
) => {
  // Try to get actual DOM measurement first
  let sceneLines = measureSceneInDOM(sceneIndex, scenes);

  // Fallback to cached measurement
  if (!sceneLines && sceneMeasurements.has(sceneIndex)) {
    sceneLines = sceneMeasurements.get(sceneIndex).lines;
  }

  // Final fallback to estimation
  if (!sceneLines) {
    sceneLines = estimateSceneLines(scenes[sceneIndex]);
  }

  // Calculate cumulative position
  let cumulativeLines = 0;
  for (let i = 0; i < sceneIndex; i++) {
    const prevLines = sceneMeasurements.has(i)
      ? sceneMeasurements.get(i).lines
      : estimateSceneLines(scenes[i]);
    cumulativeLines += prevLines;
  }

  const startPage = Math.floor(cumulativeLines / LINES_PER_PAGE) + 1;
  const sceneLengthPages = sceneLines / LINES_PER_PAGE;
  const sceneLengthEighths = Math.max(1, Math.round(sceneLengthPages * 8));

  // Convert improper fractions to mixed numbers (14/8 → 1 6/8)
  let pageLength;
  if (sceneLengthEighths >= 8) {
    const wholePages = Math.floor(sceneLengthEighths / 8);
    const remainingEighths = sceneLengthEighths % 8;
    if (remainingEighths === 0) {
      pageLength = `${wholePages}`;
    } else {
      pageLength = `${wholePages} ${remainingEighths}/8`;
    }
  } else {
    pageLength = `${sceneLengthEighths}/8`;
  }

  return {
    startPage,
    lineCount: sceneLines,
    pageLength: pageLength,
    measuredActually: sceneMeasurements.has(sceneIndex),
  };
};

const estimateSceneLines = (scene) => {
  let lines = 3; // Scene heading + spacing (matches Full Script calculation)

  scene.content.forEach((block) => {
    lines += calculateBlockLines(block);
  });

  return Math.round(lines);
};

const calculateBlockLines = (block) => {
  switch (block.type) {
    case "Action":
      return Math.ceil(block.text.length / 52) + 1.0;
    case "Character":
      return 1 + 1.0; // Character name + margin-bottom
    case "Dialogue":
      return Math.ceil(block.text.length / 35) + 1.0;
    case "Parenthetical":
      return 1 + 1.0; // Parenthetical + margin-bottom
    default:
      return Math.ceil(block.text.length / 52) + 1.0;
  }
};

const updateScenesWithPageData = (scenes) => {
  return scenes.map((scene, index) => {
    try {
      const sceneStats = calculateScenePageStats(index, scenes, 107);
      return {
        ...scene,
        pageNumber: sceneStats.startPage,
        pageLength: sceneStats.pageLength,
      };
    } catch (error) {
      console.warn(`Error calculating page stats for scene ${index}:`, error);
      return {
        ...scene,
        pageNumber: 1,
        pageLength: "1/8",
      };
    }
  });
};

// Canonical time-of-day values and accepted synonyms used when parsing free-text headings.
const TIME_OF_DAY_SYNONYMS = {
  DAY:   ["DAY", "MORNING", "AFTERNOON", "NOON"],
  NIGHT: ["NIGHT", "EVENING", "MIDNIGHT"],
  DAWN:  ["DAWN", "SUNRISE"],
  DUSK:  ["DUSK", "SUNSET", "TWILIGHT"],
  OTHER: ["OTHER"],
};

// Multi-word modifiers listed longest-first so greedy matching picks them up correctly.
const KNOWN_MODIFIERS = [
  "MOMENTS LATER", "SAME TIME", "CONTINUOUS", "EARLIER", "MEANWHILE", "LATER", "SAME",
];

const normalizeTimeOfDay = (segment) => {
  const u = (segment || "").trim().toUpperCase();
  for (const [canonical, synonyms] of Object.entries(TIME_OF_DAY_SYNONYMS)) {
    if (synonyms.includes(u)) return canonical;
  }
  return "";
};

/**
 * Parses a free-text screenplay heading into structured fields.
 *
 * Primary format (produced by buildHeadingString):
 *   INT. LOCATION - TIMEOFDAY - MODIFIER
 *
 * Fallback (legacy space-separated, no dashes):
 *   EXT. LOCATION NIGHT CONTINUOUS
 *
 * Supports INT., EXT., and I/E prefixes.
 * Returns { intExt, location, timeOfDay, modifier } — all strings, empty string when absent.
 */
const parseSceneHeading = (content) => {
  if (!content) return { intExt: "", location: "", timeOfDay: "", modifier: "" };

  const raw = content.trim().toUpperCase();
  const result = { intExt: "", location: "", timeOfDay: "", modifier: "" };

  // 1. Extract INT/EXT/I/E prefix
  let rest = raw;
  for (const prefix of ["INT.", "EXT.", "I/E"]) {
    if (raw.startsWith(prefix + " ") || raw === prefix) {
      result.intExt = prefix;
      rest = raw.slice(prefix.length).trimStart();
      break;
    }
  }

  // 2. Dash-separated format: LOCATION - TIMEOFDAY - MODIFIER
  //    Split on " - " and resolve each segment.
  if (rest.includes(" - ")) {
    const segments = rest.split(" - ").map((s) => s.trim()).filter(Boolean);
    result.location = segments[0] || "";

    if (segments.length >= 2) {
      const todCanonical = normalizeTimeOfDay(segments[1]);
      if (todCanonical) {
        result.timeOfDay = todCanonical;
        if (segments.length >= 3) {
          result.modifier = segments.slice(2).join(" - ").trim();
        }
      } else {
        // Second segment is not a time-of-day — treat everything after location as modifier.
        result.modifier = segments.slice(1).join(" - ").trim();
      }
    }
    return result;
  }

  // 3. Space-separated fallback (no dashes).
  let remaining = rest;

  // Extract modifier first (longest keyword wins).
  for (const mod of KNOWN_MODIFIERS) {
    const pattern = new RegExp(`\\b${mod.replace(/ /g, "\\s+")}\\b`, "i");
    if (pattern.test(remaining)) {
      result.modifier = mod;
      remaining = remaining.replace(pattern, "").replace(/\s+/g, " ").trim();
      break;
    }
  }

  // Extract time-of-day keyword.
  let matchedSynonym = "";
  outer: for (const [canonical, synonyms] of Object.entries(TIME_OF_DAY_SYNONYMS)) {
    for (const syn of synonyms) {
      if (new RegExp(`\\b${syn}\\b`).test(remaining)) {
        result.timeOfDay = canonical;
        matchedSynonym = syn;
        break outer;
      }
    }
  }
  if (matchedSynonym) {
    remaining = remaining
      .replace(new RegExp(`\\b${matchedSynonym}\\b`, "gi"), "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Remaining text (minus any stray dashes) is the location.
  result.location = remaining.replace(/\s*-\s*/g, " ").replace(/\s+/g, " ").trim();

  return result;
};

/**
 * Builds the canonical screenplay heading string from structured fields.
 * Produces: INT. LOCATION - TIMEOFDAY - MODIFIER
 * Missing or empty fields are omitted cleanly (no double spaces, no stray dashes).
 */
const buildHeadingString = ({ intExt = "", location = "", timeOfDay = "", modifier = "" } = {}) => {
  const parts = [intExt, location].filter(Boolean);
  if (timeOfDay) parts.push(`- ${timeOfDay}`);
  if (modifier) parts.push(`- ${modifier}`);
  return parts.join(" ").trim();
};

const extractLocations = (scenes) => {
  const locationMap = new Map();

  scenes.forEach((scene) => {
    if (scene.metadata && scene.metadata.location) {
      const locationKey = scene.metadata.location.toLowerCase();
      if (locationMap.has(locationKey)) {
        locationMap.get(locationKey).scenes.push(scene.sceneNumber);
      } else {
        locationMap.set(locationKey, {
          name: scene.metadata.location,
          intExt: scene.metadata.intExt,
          scenes: [scene.sceneNumber],
          filmingLocation: null,
        });
      }
    }
  });

  return Array.from(locationMap.values());
};

// Formatting functions
function getElementStyle(type) {
  const baseStyle = {
    fontFamily: "Courier New, monospace",
    fontSize: "12pt",
    lineHeight: "12pt",
    marginBottom: "12pt",
    color: "#000",
  };

  switch (type) {
    case "Character":
      return {
        ...baseStyle,
        marginLeft: "200px",
        textTransform: "uppercase",
        fontWeight: "normal",
      };
    case "Dialogue":
      return {
        ...baseStyle,
        marginLeft: "125px",
        marginRight: "125px",
      };
    case "Parenthetical":
      return {
        ...baseStyle,
        marginLeft: "150px",
        fontStyle: "italic",
      };
    case "Action":
      return {
        ...baseStyle,
        marginLeft: "5px",
        marginRight: "5px",
      };
    case "Scene Heading":
      return {
        ...baseStyle,
        marginLeft: "0",
        marginRight: "0",
        textTransform: "uppercase",
        fontWeight: "bold",
        marginTop: "24pt",
      };
    default:
      return baseStyle;
  }
}

function formatElementText(block) {
  let text = block.text;

  if (block.formatting) {
    if (block.formatting.bold) {
      return React.createElement("strong", null, text);
    }
    if (block.formatting.italic) {
      return React.createElement("em", null, text);
    }
    if (block.formatting.underline) {
      return React.createElement("u", null, text);
    }
  }

  if (block.type === "Character" && text.includes("(")) {
    const parts = text.split("(");
    const name = parts[0].trim();
    const extension = parts[1] ? `(${parts[1]}` : "";
    return React.createElement(
      "span",
      null,
      name,
      extension &&
        React.createElement(
          "span",
          { style: { fontWeight: "normal" } },
          ` ${extension}`
        )
    );
  }

  return text;
}

const extractLocationsHierarchical = (scenes) => {
  const locationMap = new Map();
  let locationId = 1;

  scenes.forEach((scene) => {
    if (scene.metadata && scene.metadata.location) {
      const fullLocation = scene.metadata.location.toUpperCase().trim();
      const intExt = scene.metadata.intExt || "";

      let parentLocation = "";
      let subLocation = fullLocation;

      // Enhanced pattern matching
      // Pattern 1: Possessive (SADIE'S BEDROOM, JOHN'S CAR)
      if (fullLocation.includes("'S ")) {
        const parts = fullLocation.split("'S ");
        parentLocation = parts[0] + "'S";
        subLocation = parts[1].trim();
      }
      // Pattern 2: Building types (SMITH HOUSE KITCHEN, OFFICE BUILDING LOBBY)
      else if (
        /\b(HOUSE|APARTMENT|BUILDING|OFFICE|SCHOOL|HOSPITAL|STORE|SHOP|RESTAURANT|BAR|CLUB)\b/.test(
          fullLocation
        )
      ) {
        const words = fullLocation.split(" ");
        const buildingIndex = words.findIndex((word) =>
          [
            "HOUSE",
            "APARTMENT",
            "BUILDING",
            "OFFICE",
            "SCHOOL",
            "HOSPITAL",
            "STORE",
            "SHOP",
            "RESTAURANT",
            "BAR",
            "CLUB",
          ].includes(word)
        );
        if (buildingIndex !== -1 && buildingIndex < words.length - 1) {
          parentLocation = words.slice(0, buildingIndex + 1).join(" ");
          subLocation = words.slice(buildingIndex + 1).join(" ");
        }
      }
      // Pattern 3: Vehicle types (POLICE CAR, JOHN'S TRUCK)
      else if (
        /\b(CAR|TRUCK|VAN|SUV|MOTORCYCLE|BIKE|VEHICLE)\b/.test(fullLocation)
      ) {
        const words = fullLocation.split(" ");
        const vehicleIndex = words.findIndex((word) =>
          [
            "CAR",
            "TRUCK",
            "VAN",
            "SUV",
            "MOTORCYCLE",
            "BIKE",
            "VEHICLE",
          ].includes(word)
        );
        if (vehicleIndex > 0) {
          parentLocation = words.slice(0, vehicleIndex + 1).join(" ");
          subLocation =
            vehicleIndex === words.length - 1
              ? fullLocation
              : words.slice(vehicleIndex + 1).join(" ");
        }
      }
      // Pattern 4: Room patterns (BEDROOM, KITCHEN in longer names)
      else {
        const rooms = [
          "BEDROOM",
          "BATHROOM",
          "KITCHEN",
          "LIVING ROOM",
          "DINING ROOM",
          "OFFICE",
          "GARAGE",
          "BASEMENT",
          "ATTIC",
          "HALLWAY",
          "LOBBY",
          "ENTRANCE",
        ];
        const foundRoom = rooms.find((room) => fullLocation.includes(room));
        if (foundRoom && fullLocation !== foundRoom) {
          parentLocation = fullLocation
            .replace(foundRoom, "")
            .trim()
            .replace(/\s+/g, " ");
          subLocation = foundRoom;
          // Handle cases like "MAIN BEDROOM" -> parent should include MAIN
          if (parentLocation === "") {
            const words = fullLocation.split(" ");
            const roomIndex = words.findIndex((word) =>
              foundRoom.split(" ").includes(word)
            );
            if (roomIndex > 0) {
              parentLocation = words.slice(0, roomIndex).join(" ");
              subLocation = words.slice(roomIndex).join(" ");
            }
          }
        }
      }

      // Pattern 5: Street/Address patterns (123 MAIN STREET, CENTRAL PARK)
      if (
        !parentLocation &&
        /\b(STREET|AVENUE|ROAD|PARK|PLAZA|SQUARE)\b/.test(fullLocation)
      ) {
        parentLocation = fullLocation;
        subLocation = "EXTERIOR";
      }

      // If no pattern found, treat as standalone location
      if (!parentLocation || parentLocation.trim() === "") {
        parentLocation = fullLocation;
        subLocation = fullLocation;
      }

      const locationKey = `${parentLocation}|${subLocation}`;

      if (locationMap.has(locationKey)) {
        locationMap.get(locationKey).scenes.push(scene.sceneNumber);
      } else {
        locationMap.set(locationKey, {
          id: `script_location_${Date.now()}_${locationId++}`,
          parentLocation: parentLocation,
          subLocation: subLocation,
          fullName: fullLocation,
          intExt: intExt,
          scenes: [scene.sceneNumber],
          actualLocationId: null,
          category: intExt === "INT." ? "Interior" : "Exterior",
        });
      }
    }
  });

  return Array.from(locationMap.values());
};

export {
  stemWord,
  measureSceneInDOM,
  calculateScenePageStats,
  estimateSceneLines,
  calculateBlockLines,
  LINES_PER_PAGE,
  updateScenesWithPageData,
  parseSceneHeading,
  buildHeadingString,
  extractLocations,
  extractLocationsHierarchical,
  getElementStyle,
  formatElementText,
};
