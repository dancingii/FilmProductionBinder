import React, { useState, useEffect, useRef, useCallback } from "react";
import { getElementStyle } from "../../../utils.js";

const EditablePropTitle = React.memo(
  ({ propWord, item, onTitleUpdate, onClick }) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(
      item.customTitle || item.displayName
    );

    const handleSave = () => {
      if (editValue.trim() !== item.displayName && editValue.trim() !== "") {
        onTitleUpdate(editValue.trim());
      }
      setIsEditing(false);
    };

    const handleKeyPress = (e) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        setEditValue(item.customTitle || item.displayName);
        setIsEditing(false);
      }
    };

    if (isEditing) {
      return (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyPress}
          autoFocus
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            backgroundColor: item.color,
            color: "white",
            padding: "6px 12px",
            borderRadius: "12px",
            border: "2px solid white",
            outline: "none",
            width: "200px",
          }}
        />
      );
    }

    return (
      <div
        style={{
          fontSize: "16px",
          fontWeight: "bold",
          marginBottom: "5px",
          cursor: "pointer",
          backgroundColor: item.color,
          color: "white",
          padding: "6px 12px",
          borderRadius: "12px",
          display: "inline-block",
          userSelect: "none",
          position: "relative",
        }}
        onClick={onClick}
        onDoubleClick={() => setIsEditing(true)}
      >
        {item.chronologicalNumber}. {item.customTitle || item.displayName}
        <span
          style={{
            fontSize: "10px",
            opacity: 0.7,
            marginLeft: "8px",
            fontStyle: "italic",
          }}
        >
          (double-click to edit)
        </span>
      </div>
    );
  }
);

// === CATEGORIES + ID SYSTEM INSERTED HERE ===

// ── Prop subcategories with prefix codes ──────────────────────────────────────
const PROP_SUBCATEGORIES = [
  { key: "hand",        label: "Hand Props",     prefix: "HP", color: "#FF6B6B" },
  { key: "weapons",     label: "Weapons",        prefix: "WP", color: "#D32F2F" },
  { key: "food",        label: "Food & Drink",   prefix: "FD", color: "#8D6E63" },
  { key: "documents",   label: "Documents",      prefix: "DC", color: "#1565C0" },
  { key: "furniture",   label: "Furniture",      prefix: "FN", color: "#5D4037" },
  { key: "electronics", label: "Electronics",    prefix: "EL", color: "#0288D1" },
  { key: "vehicles",    label: "Vehicles",       prefix: "VH", color: "#37474F" },
  { key: "medical",     label: "Medical",        prefix: "MD", color: "#00838F" },
  { key: "money",       label: "Money",          prefix: "MN", color: "#2E7D32" },
  { key: "misc",        label: "Miscellaneous",  prefix: "MS", color: "#757575" },
];

const SUBCATEGORY_MAP = Object.fromEntries(
  PROP_SUBCATEGORIES.map((s) => [s.key, s])
);

function PropsModule({
  taggedItems,
  scenes,
  stripboardScenes,
  characters,
  setActiveModule,
  setCurrentIndex,
  onUpdatePropTitle,
  onRemovePropFromScene,
  onCreatePropVariant,
  onAddPropToScene,
  onCreateNewProp,
  onUpdateTaggedItems,
  onSyncTaggedItems,
  stemWord,
  onDeleteProp,
  showConfirm,
  onUploadPropImage,
  onDeletePropImage,
  projectSettings,
}) {
  const [showScenesWithoutProps, setShowScenesWithoutProps] = useState(false);
  const [selectedProp, setSelectedProp] = useState(null);
  const [showScenePreview, setShowScenePreview] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [propImageUploading, setPropImageUploading] = useState(false);
  const [characterFilter, setCharacterFilter] = useState([]);
  const [subcategoryFilter, setSubcategoryFilter] = useState([]); // [] = all (multi)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [categoryAccordionOpen, setCategoryAccordionOpen] = useState(true);
  const [characterAccordionOpen, setCharacterAccordionOpen] = useState(true);
  // Print queue
  const [printQueue, setPrintQueue] = useState([]);
  const [showPrintQueue, setShowPrintQueue] = useState(false);
  const [printFormat, setPrintFormat] = useState("avery5163");
  const [usedSlots, setUsedSlots] = useState([]);
  const [showBadgeSection, setShowBadgeSection] = useState(false);

  // --- Script search state for new custom props ---
  const [propSearchQuery, setPropSearchQuery] = useState("");
  const [propSearchResults, setPropSearchResults] = useState(null);
  // instanceStatuses: { [instanceId]: "confirmed" | "rejected" | "pending" }
  const [instanceStatuses, setInstanceStatuses] = useState({});
  // instanceCharacters: { [instanceId]: characterName }
  const [instanceCharacters, setInstanceCharacters] = useState({});
  // instanceVariants: { [instanceId]: variantName }
  const [instanceVariants, setInstanceVariants] = useState({});
  const [showPropScriptViewer, setShowPropScriptViewer] = useState(false);
  const [propViewerSceneIdx, setPropViewerSceneIdx] = useState(0);
  const [propViewerInstanceIdx, setPropViewerInstanceIdx] = useState(0);
  // mini popup for a clicked instance: { instanceId, blockIndex, wordIndex }
  const [instancePopup, setInstancePopup] = useState(null);
  const [instancePopupVariantInput, setInstancePopupVariantInput] =
    useState("");
  const [instancePopupCharInput, setInstancePopupCharInput] = useState("");
  const [propNameManuallyEdited, setPropNameManuallyEdited] = useState(false);
  // Live preview of confirmed scenes during viewer session
  const [pendingPropScenes, setPendingPropScenes] = useState([]);
  // Track variants created this session: { [characterName]: propWord }
  const [sessionVariants, setSessionVariants] = useState({});
  // The primary character assigned this session (first one chosen)
  const [primarySessionChar, setPrimarySessionChar] = useState(null);
  // The most recently chosen character (for pre-populating next popup)
  const [lastChosenChar, setLastChosenChar] = useState(null);
  // Multi-character selection toggle + selected chars for current popup
  const [instancePopupMultiSelect, setInstancePopupMultiSelect] = useState(false);
  const [instancePopupMultiChars, setInstancePopupMultiChars] = useState([]);
  const [instancePopupCharDropdownOpen, setInstancePopupCharDropdownOpen] = useState(false);
  const [charDropdownFlipped, setCharDropdownFlipped] = useState(false);
  const [fullScriptSceneIdx, setFullScriptSceneIdx] = useState(0);
  const charDropdownTriggerRef = React.useRef(null);
  const [showFullScriptViewer, setShowFullScriptViewer] = useState(false);

  const propViewerScrollRef = React.useRef(null);
  const propViewerCurrentRef = React.useRef(null);

  // Auto-scroll to current instance when it changes
  React.useEffect(() => {
    if (
      !showPropScriptViewer ||
      !propViewerCurrentRef.current ||
      !propViewerScrollRef.current
    )
      return;
    const container = propViewerScrollRef.current;
    const target = propViewerCurrentRef.current;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetCenter = targetRect.top + targetRect.height / 2;
    const containerCenter = containerRect.top + containerRect.height / 2;
    const offset = targetCenter - containerCenter;
    container.scrollBy({ top: offset, behavior: "smooth" });
  }, [propViewerInstanceIdx, propViewerSceneIdx, showPropScriptViewer]);

  // Search the script for prefix matches of the query (supports multi-word phrases)
  const searchScript = React.useCallback(
    (query) => {
      if (!query || !query.trim() || !stemWord) {
        setPropSearchResults(null);
        return;
      }
      const queryWords = query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const isMultiWord = queryWords.length > 1;
      const stemmedQueryWords = queryWords.map((w) =>
        stemWord(w.replace(/[^\w]/g, ""))
      );
      const instancesByScene = {}; // sceneIndex -> [instanceId (of first word in match), ...]

      for (let si = 0; si < scenes.length; si++) {
        const scene = scenes[si];
        if (!scene.content) continue;
        for (let bi = 0; bi < scene.content.length; bi++) {
          const block = scene.content[bi];
          const rawWords = block.text.split(/(\s+)/);
          // Build index of non-whitespace words with their positions
          const wordTokens = [];
          for (let wi = 0; wi < rawWords.length; wi++) {
            if (rawWords[wi].trim())
              wordTokens.push({ wi, text: rawWords[wi] });
          }

          for (let ti = 0; ti < wordTokens.length; ti++) {
            const token = wordTokens[ti];
            const clean = token.text.toLowerCase().replace(/[^\w]/g, "");
            const stemmed = stemWord(clean);

            if (isMultiWord) {
              // Check if this and the next N-1 tokens match the phrase
              const firstStemmed = stemmedQueryWords[0];
              if (!stemmed.startsWith(firstStemmed)) continue;
              let matched = true;
              for (let qi = 1; qi < stemmedQueryWords.length; qi++) {
                const nextToken = wordTokens[ti + qi];
                if (!nextToken) {
                  matched = false;
                  break;
                }
                const nextClean = nextToken.text
                  .toLowerCase()
                  .replace(/[^\w]/g, "");
                const nextStemmed = stemWord(nextClean);
                if (!nextStemmed.startsWith(stemmedQueryWords[qi])) {
                  matched = false;
                  break;
                }
              }
              if (!matched) continue;
              if (!instancesByScene[si]) instancesByScene[si] = [];
              const groupIds = [];
              for (let qi = 0; qi < stemmedQueryWords.length; qi++) {
                const t = wordTokens[ti + qi];
                groupIds.push(`${si}-${bi}-${t.wi}`);
              }
              const primaryId = groupIds[0];
              instancesByScene[si].push(primaryId);
              // Store all word positions under the primary ID so the viewer highlights all
              instancesByScene[`_group_${primaryId}`] = groupIds;
            } else {
              // Single word prefix match
              if (
                stemmed.startsWith(stemmedQueryWords[0]) ||
                clean.startsWith(queryWords[0])
              ) {
                const id = `${si}-${bi}-${token.wi}`;
                if (!instancesByScene[si]) instancesByScene[si] = [];
                instancesByScene[si].push(id);
              }
            }
          }
        }
      }

      const sceneIndices = Object.keys(instancesByScene)
        .filter((k) => !k.startsWith("_group_"))
        .map(Number)
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);
      setPropSearchResults({ instancesByScene, sceneIndices });
    },
    [scenes, stemWord]
  );

  // Run search as query changes — only during new custom prop creation flow
  React.useEffect(() => {
    if (selectedProp?.isNewCustomProp) {
      searchScript(propSearchQuery);
    }
  }, [propSearchQuery, selectedProp?.isNewCustomProp, searchScript]);

  // Populate search results when scene preview opens for an existing prop
  // so the word-level highlighting works in the script viewer
  React.useEffect(() => {
    if (showScenePreview && selectedProp && !selectedProp.isNewCustomProp) {
      const name = selectedProp.customTitle || selectedProp.displayName;
      if (name) searchScript(name);
    }
  }, [showScenePreview, selectedProp?.word, searchScript]);

  // When opening the script viewer, initialise statuses for all found instances
  const openPropScriptViewer = () => {
    if (!propSearchResults) return;
    const { instancesByScene, sceneIndices } = propSearchResults;

    // For existing props, pre-mark instances as confirmed if their scene
    // is already saved in the prop's scenes array
    const savedScenes = selectedProp?.isNewCustomProp
      ? []
      : (selectedProp?.scenes || []).map(String);

    const init = {};
    sceneIndices.forEach((si) => {
      const sceneNum = String(scenes[si]?.sceneNumber);
      const isAlreadySaved = savedScenes.includes(sceneNum);
      (instancesByScene[si] || []).forEach((id) => {
        if (!instanceStatuses[id]) {
          init[id] = isAlreadySaved ? "confirmed" : "pending";
        }
      });
    });

    setInstanceStatuses((prev) => ({ ...init, ...prev }));

    // Jump to first pending (unreviewed) instance, or start at 0 if all confirmed
    let startScene = 0;
    let startInst = 0;
    outer: for (let si = 0; si < sceneIndices.length; si++) {
      const insts = instancesByScene[sceneIndices[si]] || [];
      for (let ii = 0; ii < insts.length; ii++) {
        if (init[insts[ii]] !== "confirmed") {
          startScene = si;
          startInst = ii;
          break outer;
        }
      }
    }

    setPropViewerSceneIdx(startScene);
    setPropViewerInstanceIdx(startInst);
    setShowPropScriptViewer(true);
  };

  // Navigate instances: advance to next pending/unreviewed instance
  const advanceToNextInstance = (currentSceneIdx, currentInstIdx, statuses) => {
    if (!propSearchResults) return;
    const { instancesByScene, sceneIndices } = propSearchResults;
    // Try remaining instances in current scene
    const curSceneInstances =
      instancesByScene[sceneIndices[currentSceneIdx]] || [];
    for (let i = currentInstIdx + 1; i < curSceneInstances.length; i++) {
      if (statuses[curSceneInstances[i]] !== "rejected") {
        setPropViewerInstanceIdx(i);
        return;
      }
    }
    // Move to next scene
    for (let si = currentSceneIdx + 1; si < sceneIndices.length; si++) {
      const insts = instancesByScene[sceneIndices[si]] || [];
      for (let i = 0; i < insts.length; i++) {
        if (statuses[insts[i]] !== "rejected") {
          setPropViewerSceneIdx(si);
          setPropViewerInstanceIdx(i);
          return;
        }
      }
    }
    // All done — stay on last
  };

  // Build confirmed scenes list from statuses
  const getConfirmedScenes = () => {
    if (!propSearchResults) return [];
    const { instancesByScene, sceneIndices } = propSearchResults;
    return sceneIndices
      .filter((si) =>
        (instancesByScene[si] || []).some(
          (id) => instanceStatuses[id] === "confirmed"
        )
      )
      .map((si) => scenes[si]?.sceneNumber)
      .filter(Boolean);
  };

  // Reset search state when popup closes
  const closePropPopup = () => {
    setSelectedProp(null);
    setPropSearchQuery("");
    setPropSearchResults(null);
    setInstanceStatuses({});
    setInstanceCharacters({});
    setInstanceVariants({});
    setShowPropScriptViewer(false);
    setInstancePopup(null);
    setPropNameManuallyEdited(false);
    setPendingPropScenes([]);
    setSessionVariants({});
    setPrimarySessionChar(null);
    setLastChosenChar(null);
  };

  const getEarliestSceneNum = (prop) => {
    const s = prop.scenes || [];
    if (s.length === 0) return Infinity;
    const nums = s.map((n) => parseFloat(n)).filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.min(...nums) : Infinity;
  };

  const propItems = Object.entries(taggedItems)
    .filter(([word, item]) => item.category === "Props")
    .sort((a, b) => {
      const aMin = getEarliestSceneNum(a[1]);
      const bMin = getEarliestSceneNum(b[1]);
      if (aMin !== bMin) return aMin - bMin;
      return (a[1].chronologicalNumber || 0) - (b[1].chronologicalNumber || 0);
    });

  // Display number = position in chronological scene order (1-based)
  const propNumberMap = Object.fromEntries(
    propItems.map(([word], idx) => [word, idx + 1])
  );

  // Generate unique prop ID like HP_001, WP_003
  const generatePropId = (subcategoryKey) => {
    const sub = SUBCATEGORY_MAP[subcategoryKey] || SUBCATEGORY_MAP["misc"];
    const prefix = sub.prefix;
    const existing = Object.values(taggedItems)
      .filter((item) => item.category === "Props" && item.propId && item.propId.startsWith(prefix + "_"))
      .map((item) => parseInt(item.propId.split("_")[1]) || 0)
      .sort((a, b) => b - a);
    const next = existing.length > 0 ? existing[0] + 1 : 1;
    return `${prefix}_${String(next).padStart(3, "0")}`;
  };


  // Sync chronologicalNumber back to DB whenever scene-sorted order
  // differs from stored values — keeps all modules in agreement
  const propNumberSyncedRef = React.useRef(false);
  React.useEffect(() => {
    if (propItems.length === 0) return;
    const needsUpdate = propItems.some(
      ([word], idx) =>
        taggedItems[word]?.chronologicalNumber !== idx + 1
    );
    if (!needsUpdate) {
      propNumberSyncedRef.current = true;
      return;
    }
    const updated = { ...taggedItems };
    propItems.forEach(([word], idx) => {
      updated[word] = { ...updated[word], chronologicalNumber: idx + 1 };
    });
    onUpdateTaggedItems(updated);
    onSyncTaggedItems(updated);
    propNumberSyncedRef.current = true;
  }, [propItems.map(([w]) => w).join(",")]);

  // propId auto-assign removed — IDs are now manually assigned and locked by user

  // ── Badge & Print helpers ─────────────────────────────────────────────────
  const getPropDeepLink = (propId) =>
    `${window.location.origin}/?prop=${encodeURIComponent(propId)}`;

  const getPropQrImgUrl = (propId, size = 100) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(getPropDeepLink(propId))}`;

  const generateDymoXml = (prop, filmTitle) => {
    const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const chars = (prop.assignedCharacters || []).join(", ");
    const qrUrl = getPropDeepLink(prop.propId || "");
    return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>LargeSplash</Id>
  <PaperName>30346 Durable ID Label</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="3240" Height="1800" Rx="270" Ry="270" />
  </DrawCommands>
  <ObjectInfo>
    <TextObject>
      <Name>FilmTitle</Name>
      <ForeColor Alpha="255" Red="100" Green="100" Blue="100" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Top</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText><Element><String>${esc(filmTitle)}</String>
        <Attributes><Font Family="Helvetica" Size="7" Bold="False" Italic="True" Underline="False" StrikeOut="False" />
        <ForeColor Alpha="255" Red="100" Green="100" Blue="100" /></Attributes></Element></StyledText>
    </TextObject>
    <ObjectLayout><DYMOPoint><X>90</X><Y>90</Y></DYMOPoint><Size><Width>2160</Width><Height>200</Height></Size><ZOrder>0</ZOrder></ObjectLayout>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>PropName</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText><Element><String>${esc(prop.customTitle || prop.displayName)}</String>
        <Attributes><Font Family="Helvetica" Size="14" Bold="True" Italic="False" Underline="False" StrikeOut="False" />
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" /></Attributes></Element></StyledText>
    </TextObject>
    <ObjectLayout><DYMOPoint><X>90</X><Y>300</Y></DYMOPoint><Size><Width>2160</Width><Height>600</Height></Size><ZOrder>1</ZOrder></ObjectLayout>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>PropId</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText><Element><String>${esc(prop.propId || "UNASSIGNED")}</String>
        <Attributes><Font Family="Courier New" Size="10" Bold="True" Italic="False" Underline="False" StrikeOut="False" />
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" /></Attributes></Element></StyledText>
    </TextObject>
    <ObjectLayout><DYMOPoint><X>90</X><Y>900</Y></DYMOPoint><Size><Width>2160</Width><Height>300</Height></Size><ZOrder>2</ZOrder></ObjectLayout>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>Character</Name>
      <ForeColor Alpha="255" Red="80" Green="80" Blue="80" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText><Element><String>${esc(chars)}</String>
        <Attributes><Font Family="Helvetica" Size="8" Bold="False" Italic="False" Underline="False" StrikeOut="False" />
        <ForeColor Alpha="255" Red="80" Green="80" Blue="80" /></Attributes></Element></StyledText>
    </TextObject>
    <ObjectLayout><DYMOPoint><X>90</X><Y>1200</Y></DYMOPoint><Size><Width>2160</Width><Height>400</Height></Size><ZOrder>3</ZOrder></ObjectLayout>
  </ObjectInfo>
  <ObjectInfo>
    <BarcodeObject>
      <Name>QRCode</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <Text>${qrUrl}</Text>
      <Type>QRCode</Type>
      <Size>Medium</Size>
      <ECLevel>0</ECLevel>
    </BarcodeObject>
    <ObjectLayout><DYMOPoint><X>2340</X><Y>90</Y></DYMOPoint><Size><Width>810</Width><Height>1620</Height></Size><ZOrder>4</ZOrder></ObjectLayout>
  </ObjectInfo>
</DieCutLabel>`;
  };

  const exportDymoPdf = (prop, filmTitle) => {
    const chars = (prop.assignedCharacters || []).join(", ");
    const subMeta = SUBCATEGORY_MAP[prop.propSubcategory || "misc"] || SUBCATEGORY_MAP["misc"];
    const qrUrl = getPropQrImgUrl(prop.propId || "", 54);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${prop.propId} Badge</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:2.25in 1.25in;margin:0}
  body{width:2.25in;height:1.25in;font-family:Helvetica,Arial,sans-serif;overflow:hidden}
  .badge{display:flex;width:2.25in;height:1.25in;padding:5px}
  .text{flex:1;display:flex;flex-direction:column;justify-content:center;gap:2px;padding-right:4px;overflow:hidden}
  .film{font-size:5pt;color:#888;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .name{font-size:9pt;font-weight:bold;line-height:1.1;overflow:hidden}
  .pid{font-size:7pt;font-weight:bold;color:white;background:${subMeta.color};display:inline-block;padding:1px 4px;border-radius:2px;font-family:monospace}
  .char{font-size:6pt;color:#555;margin-top:1px}
  .qr{width:54px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
</style></head><body>
<div class="badge">
  <div class="text">
    <div class="film">${filmTitle || ""}</div>
    <div class="name">${prop.customTitle || prop.displayName}</div>
    ${prop.propId ? `<div class="pid">${prop.propId}</div>` : ""}
    ${chars ? `<div class="char">${chars}</div>` : ""}
  </div>
  <div class="qr"><img src="${qrUrl}" width="54" height="54" /></div>
</div>
<script>var img=document.querySelector('img');img.onload=function(){window.print()};img.onerror=function(){window.print()};setTimeout(function(){window.print()},3000);<\/script>
</body></html>`;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  const generateBadgePrintHtml = (props, format, usedSlots, filmTitle) => {
    const fmtCfg = {
      avery5163: { cols: 2, rows: 5, total: 10, lw: "4in", lh: "2in", mt: "0.5in", ml: "0.17in", gap: "0.17in", qSize: 72, namePt: 16, filmPt: 7, idPt: 9, charPt: 8 },
      avery5160: { cols: 3, rows: 10, total: 30, lw: "2.625in", lh: "1in", mt: "0.5in", ml: "0.19in", gap: "0.125in", qSize: 44, namePt: 9, filmPt: 5, idPt: 7, charPt: 6 },
    };
    const cfg = fmtCfg[format];
    const availSlots = Array.from({ length: cfg.total }, (_, i) => i).filter(i => !usedSlots.includes(i));
    const labels = Array.from({ length: cfg.total }, (_, i) => {
      if (usedSlots.includes(i)) return `<div class="label empty"></div>`;
      const pIdx = availSlots.indexOf(i);
      const prop = pIdx >= 0 && pIdx < props.length ? props[pIdx] : null;
      if (!prop) return `<div class="label empty"></div>`;
      const subMeta = SUBCATEGORY_MAP[prop.propSubcategory || "misc"] || SUBCATEGORY_MAP["misc"];
      const chars = (prop.assignedCharacters || []).join(", ");
      const qrSrc = getPropQrImgUrl(prop.propId || "", cfg.qSize);
      return `<div class="label">
        <div class="lc">
          <div class="lt">
            <div style="font-size:${cfg.filmPt}pt;color:#888;font-style:italic">${filmTitle || ""}</div>
            <div style="font-size:${cfg.namePt}pt;font-weight:bold;line-height:1.1">${prop.customTitle || prop.displayName}</div>
            ${prop.propId ? `<div style="font-size:${cfg.idPt}pt;font-weight:bold;color:white;background:${subMeta.color};display:inline-block;padding:1px 5px;border-radius:2px;font-family:monospace;margin-top:2px">${prop.propId}</div>` : ""}
            ${chars ? `<div style="font-size:${cfg.charPt}pt;color:#444;margin-top:2px">${chars}</div>` : ""}
          </div>
          <div class="lq"><img src="${qrSrc}" width="${cfg.qSize}" height="${cfg.qSize}" /></div>
        </div>
      </div>`;
    }).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Prop Badges</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:8.5in 11in;margin:0}
  body{font-family:Helvetica,Arial,sans-serif}
  .sheet{display:grid;grid-template-columns:repeat(${cfg.cols},${cfg.lw});gap:0 ${cfg.gap};padding:${cfg.mt} ${cfg.ml}}
  .label{width:${cfg.lw};height:${cfg.lh};overflow:hidden;padding:6px}
  .label.empty{background:transparent}
  .lc{display:flex;height:100%}
  .lt{flex:1;display:flex;flex-direction:column;justify-content:center;gap:2px;padding-right:6px;overflow:hidden}
  .lq{display:flex;align-items:center;justify-content:center;width:${cfg.qSize + 4}px;flex-shrink:0}
  @media print{.label.empty{background:transparent}}
</style></head><body>
<div class="sheet">${labels}</div>
<script>
  var imgs=document.querySelectorAll('img'),loaded=0;
  if(imgs.length===0){window.print();}
  else{imgs.forEach(function(i){i.onload=i.onerror=function(){if(++loaded===imgs.length)window.print();}});}
  setTimeout(function(){window.print()},5000);
<\/script>
</body></html>`;
  };
  // Get props for a specific scene
  const getPropsForScene = (sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return [];
    const sceneNumber = scene.sceneNumber;
    const sceneProps = [];

    propItems.forEach(([word, prop]) => {
      // First check scenes array (manually created props store scene numbers here)
      const inScenesArray = (prop.scenes || []).some(
        (s) => String(s) === String(sceneNumber)
      );

      // Also check instances array (script-tagged props)
      const inInstances = (prop.instances || []).some((instance) => {
        const instSceneIdx = parseInt(instance.split("-")[0]);
        return instSceneIdx === sceneIndex && !instance.excluded;
      });

      // Also check pending confirmed scenes from script viewer (live preview)
      const isPending =
        selectedProp?.isNewCustomProp &&
        pendingPropScenes.includes(sceneNumber);

      if (inScenesArray || inInstances || isPending) {
        sceneProps.push({ word, ...prop });
      }
    });

    return sceneProps.sort(
      (a, b) => a.chronologicalNumber - b.chronologicalNumber
    );
  };

  // Filter scenes based on whether they have props
  const filteredScenes = scenes.filter((scene, index) => {
    const sceneProps = getPropsForScene(index);
    return showScenesWithoutProps || sceneProps.length > 0;
  });

  const handlePropClick = (prop, sceneIndex) => {
    // Single click - show prop details popup (placeholder for future)
    setSelectedProp({ ...prop, contextScene: sceneIndex });
  };

  const handlePropDoubleClick = (prop, sceneIndex) => {
    // Double click - navigate to scene in script module
    setCurrentIndex(sceneIndex);
    setActiveModule("Script");
  };

  const handleRemovePropFromScene = (propWord, sceneIndex) => {
    // This would need to be implemented in the parent component
    // For now, just close any open popups
    setSelectedProp(null);
  };

  // ESC key closes all popups
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      if (instancePopup) {
        setInstancePopup(null);
        return;
      }
      if (showPropScriptViewer) {
        setShowPropScriptViewer(false);
        return;
      }
      if (showScenePreview) {
        setShowScenePreview(false);
        return;
      }
      if (selectedProp) {
        closePropPopup();
        return;
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [instancePopup, showPropScriptViewer, showScenePreview, selectedProp]);

  return (
    <div
    style={{
      padding: "20px",
      height: "calc(100vh - 60px)",
      width: "100%",
      display: "flex",
      gap: "15px",
      maxWidth: "100%",
      overflowX: "hidden",
      boxSizing: "border-box",
    }}
    >
      {/* Left Column - Props List */}
      <div
        style={{
          flex: "0 0 25%",
          maxWidth: "25%",
          height: "100%",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ margin: 0 }}>Props</h2>
          <button
            onClick={() => setShowPrintQueue(true)}
            style={{
              backgroundColor: printQueue.length > 0 ? "#1976d2" : "#e0e0e0",
              color: printQueue.length > 0 ? "white" : "#555",
              border: "none", borderRadius: "4px",
              padding: "8px 12px", cursor: "pointer",
              fontSize: "12px", fontWeight: "bold",
            }}
          >
            🖨{printQueue.length > 0 ? ` Queue (${printQueue.length})` : " Queue"}
          </button>
          <button
            onClick={() => {
              // Create a temporary prop object to open the popup
              const tempProp = {
                word: `custom_${Date.now()}`, // Temporary unique identifier
                displayName: "New Custom Prop",
                customTitle: "New Custom Prop",
                category: "Props",
                color:
                  Object.values(taggedItems).find(
                    (item) => item.category === "Props"
                  )?.color || "#FF6B6B",
                chronologicalNumber: propItems.length + 1,
                scenes: [],
                contextScene: null,
                isNewCustomProp: true, // Flag to identify this as a new custom prop
                propSubcategory: "misc",
                propId: generatePropId("misc"),
              };
              setSelectedProp(tempProp);
            }}
            style={{
              backgroundColor: "#4CAF50",
              color: "white",
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            + Add Custom Prop
          </button>
        </div>

        {/* Combined filter dropdown */}
        {(() => {
          const hasAnyFilter = subcategoryFilter.length > 0 || characterFilter.length > 0;
          const activeFilterCount = subcategoryFilter.length + characterFilter.length;
          const activeCatsWithProps = PROP_SUBCATEGORIES.filter((sub) =>
            Object.values(taggedItems).some(
              (item) => item.category === "Props" && (item.propSubcategory || "misc") === sub.key
            )
          );
          const hasCharacters = Object.keys(characters || {}).length > 0;
          return (
            <div style={{ marginBottom: "12px", position: "relative" }}>
              {/* Trigger button */}
              <button
                onClick={() => setShowFilterDropdown((prev) => !prev)}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  border: `1px solid ${hasAnyFilter ? "#1976d2" : "#ccc"}`,
                  borderRadius: "4px",
                  backgroundColor: hasAnyFilter ? "#e3f2fd" : "white",
                  cursor: "pointer",
                  fontSize: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxSizing: "border-box",
                }}
              >
                <span style={{ color: hasAnyFilter ? "#1565c0" : "#555", fontWeight: hasAnyFilter ? "bold" : "normal" }}>
                  {hasAnyFilter ? `${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""} active` : "Filter props…"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {hasAnyFilter && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSubcategoryFilter([]);
                        setCharacterFilter([]);
                      }}
                      style={{ fontSize: "11px", color: "#1976d2", fontWeight: "bold", cursor: "pointer", lineHeight: 1 }}
                      title="Clear all filters"
                    >
                      ✕
                    </span>
                  )}
                  <span style={{ fontSize: "10px", opacity: 0.6 }}>{showFilterDropdown ? "▲" : "▼"}</span>
                </div>
              </button>

              {showFilterDropdown && (
                <>
                  <div
                    style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 299 }}
                    onClick={() => setShowFilterDropdown(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      width: "100%",
                      backgroundColor: "white",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      zIndex: 300,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                      boxSizing: "border-box",
                      maxHeight: "340px",
                      overflowY: "auto",
                    }}
                  >
                    {/* ── Categories accordion ── */}
                    <div>
                      <div
                        onClick={() => setCategoryAccordionOpen((p) => !p)}
                        style={{
                          padding: "7px 10px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: "#f5f5f5",
                          borderBottom: "1px solid #e0e0e0",
                          userSelect: "none",
                        }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: "bold", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Categories
                          {subcategoryFilter.length > 0 && (
                            <span style={{ marginLeft: "6px", color: "#1976d2" }}>({subcategoryFilter.length})</span>
                          )}
                        </span>
                        <span style={{ fontSize: "10px", color: "#888" }}>{categoryAccordionOpen ? "▲" : "▼"}</span>
                      </div>
                      {categoryAccordionOpen && (
                        <div style={{ padding: "4px 0" }}>
                          {activeCatsWithProps.map((sub) => {
                            const count = Object.values(taggedItems).filter(
                              (item) => item.category === "Props" && (item.propSubcategory || "misc") === sub.key
                            ).length;
                            const checked = subcategoryFilter.includes(sub.key);
                            return (
                              <label
                                key={sub.key}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "5px 10px",
                                  cursor: "pointer",
                                  backgroundColor: checked ? "#fff8e1" : "transparent",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    setSubcategoryFilter((prev) =>
                                      e.target.checked ? [...prev, sub.key] : prev.filter((k) => k !== sub.key)
                                    )
                                  }
                                  style={{ cursor: "pointer", flexShrink: 0 }}
                                />
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: "bold",
                                    color: "white",
                                    backgroundColor: sub.color,
                                    borderRadius: "3px",
                                    padding: "1px 5px",
                                    fontFamily: "monospace",
                                    flexShrink: 0,
                                  }}
                                >
                                  {sub.prefix}
                                </span>
                                <span style={{ flex: 1, fontSize: "12px", color: checked ? "#333" : "#555", fontWeight: checked ? "bold" : "normal" }}>
                                  {sub.label}
                                </span>
                                <span style={{ fontSize: "10px", color: "#999" }}>{count}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── Characters accordion ── */}
                    {hasCharacters && (
                      <div>
                        <div
                          onClick={() => setCharacterAccordionOpen((p) => !p)}
                          style={{
                            padding: "7px 10px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: "#f5f5f5",
                            borderTop: "1px solid #e0e0e0",
                            borderBottom: "1px solid #e0e0e0",
                            userSelect: "none",
                          }}
                        >
                          <span style={{ fontSize: "11px", fontWeight: "bold", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Characters
                            {characterFilter.length > 0 && (
                              <span style={{ marginLeft: "6px", color: "#1976d2" }}>({characterFilter.length})</span>
                            )}
                          </span>
                          <span style={{ fontSize: "10px", color: "#888" }}>{characterAccordionOpen ? "▲" : "▼"}</span>
                        </div>
                        {characterAccordionOpen && (
                          <div style={{ padding: "4px 0" }}>
                            {Object.keys(characters).sort().map((c) => {
                              const checked = characterFilter.includes(c);
                              return (
                                <label
                                  key={c}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "5px 10px",
                                    cursor: "pointer",
                                    backgroundColor: checked ? "#e3f2fd" : "transparent",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                      setCharacterFilter((prev) =>
                                        e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)
                                      )
                                    }
                                    style={{ cursor: "pointer", flexShrink: 0 }}
                                  />
                                  <span style={{ fontSize: "12px", color: checked ? "#1565c0" : "#555", fontWeight: checked ? "bold" : "normal" }}>
                                    {c}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        <div style={{ marginBottom: "20px" }}>
          {propItems.length === 0 ? (
            <p style={{ color: "#888", fontStyle: "italic", fontSize: "13px" }}>
              No props tagged yet. Tag words in the Script module or add a
              custom prop above.
            </p>
          ) : (
            <p>
              Total Props: {propItems.length}
              {(characterFilter.length > 0 || subcategoryFilter.length > 0) && (
                <span style={{ color: "#888", fontSize: "11px", marginLeft: "6px" }}>
                  ({propItems.filter(([, item]) =>
                    (characterFilter.length === 0 || (item.assignedCharacters || []).some((c) => characterFilter.includes(c))) &&
                    (subcategoryFilter.length === 0 || subcategoryFilter.includes(item.propSubcategory || "misc"))
                  ).length} shown)
                </span>
              )}
            </p>
          )}
        </div>

        <div style={{ width: "100%" }}>
          {propItems
            .filter(([, item]) =>
              characterFilter.length === 0
                ? true
                : (item.assignedCharacters || []).some((c) =>
                    characterFilter.includes(c)
                  )
            )
            .filter(([, item]) =>
              subcategoryFilter.length === 0 ? true : subcategoryFilter.includes(item.propSubcategory || "misc")
            )
            .map(([word, item]) => {
            // Convert hex color to more pastel version
            const getPastelColor = (hexColor) => {
              const r = parseInt(hexColor.slice(1, 3), 16);
              const g = parseInt(hexColor.slice(3, 5), 16);
              const b = parseInt(hexColor.slice(5, 7), 16);
              // Blend with white to create pastel effect
              const pastelR = Math.round(r + (255 - r) * 0.7);
              const pastelG = Math.round(g + (255 - g) * 0.7);
              const pastelB = Math.round(b + (255 - b) * 0.7);
              return `rgb(${pastelR}, ${pastelG}, ${pastelB})`;
            };

            // Get character assignments for this prop
            const assignedCharacters = item.assignedCharacters || [];
            const hasMultipleCharacters = assignedCharacters.length > 1;

            // Capitalize first letter of prop name
            const capitalizedName =
              (item.customTitle || item.displayName).charAt(0).toUpperCase() +
              (item.customTitle || item.displayName).slice(1);

            return (
              <div
                key={word}
                style={{
                  backgroundColor: getPastelColor(item.color),
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "5px 8px",
                  margin: "3px 0",
                  fontSize: "12px",
                  position: "relative",
                  width: "100%",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                a
                >
                {/* Left: text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Line 1: prop number + name + Default badge */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "3px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "bold",
                        fontSize: "15px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        alignSelf: "flex-start",
                        position: "relative",
                        top: "-4px",
                      }}
                      onClick={() =>
                        setSelectedProp({ word, ...item, contextScene: null })
                      }
                    >
                      {propNumberMap[word]}. {capitalizedName}
                    </span>
                    {item.defaultCharacter && (
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: "bold",
                          color: item.color,
                          backgroundColor: "white",
                          border: `1.5px solid ${item.color}`,
                          borderRadius: "4px",
                          padding: "1px 5px",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          lineHeight: 1.4,
                          flexShrink: 0,
                        }}
                      >
                        Default
                      </span>
                    )}
                    {/* Spacer pushes ID badge right */}
                    <span style={{ flex: 1 }} />
                    {/* Prop ID badge */}
                    {item.propId ? (
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, position: "relative" }}>
                        <span style={{
                          fontSize: "9px", fontWeight: "bold", color: "white",
                          backgroundColor: (SUBCATEGORY_MAP[item.propSubcategory || "misc"] || SUBCATEGORY_MAP["misc"]).color,
                          borderRadius: "3px", padding: "1px 6px", letterSpacing: "0.05em", fontFamily: "monospace",
                          position: "relative", top: "-6px",
                        }}>
                          {item.propId}
                        </span>
                        {item.propIdLocked && (
                          <span style={{ position: "absolute", bottom: "-20px", fontSize: "16px", lineHeight: 1 }}>🔒</span>
                        )}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: "9px", fontWeight: "bold", color: "#888",
                        backgroundColor: "#eee", borderRadius: "3px",
                        padding: "1px 6px", flexShrink: 0, fontFamily: "monospace",
                      }}>
                        unassigned
                      </span>
                    )}
                  </div>
                  {/* Line 2: Manage button + character pills */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() =>
                        setSelectedProp({ word, ...item, contextScene: null })
                      }
                      style={{
                        backgroundColor: "#2196F3",
                        color: "white",
                        border: "none",
                        padding: "3px 8px",
                        borderRadius: "2px",
                        cursor: "pointer",
                        fontSize: "10px",
                        flexShrink: 0,
                      }}
                    >
                      Manage
                    </button>
                    {assignedCharacters.map((char) => (
                      <span
                        key={char}
                        style={{
                          backgroundColor: item.color,
                          color: "white",
                          borderRadius: "10px",
                          padding: "1px 6px",
                          fontSize: "9px",
                          fontWeight: "bold",
                        }}
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: prop photos — always visible, placeholder when empty */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    flexShrink: 0,
                  }}
                >
                  {item.photos && item.photos.length > 0 ? (
                    item.photos.map((photo, idx) => (
                      <img
                        key={idx}
                        src={photo}
                        alt={`${capitalizedName} ${idx + 1}`}
                        onClick={() => setLightboxImage(photo)}
                        style={{
                          width: "44px",
                          height: "44px",
                          objectFit: "cover",
                          border: `3px solid ${item.color}`,
                          borderRadius: "3px",
                          cursor: "pointer",
                          display: "block",
                        }}
                      />
                    ))
                  ) : (
                    <div
                      onClick={() =>
                        setSelectedProp({ word, ...item, contextScene: null })
                      }
                      title="Open prop to add a photo"
                      style={{
                        width: "44px",
                        height: "44px",
                        border: `3px solid ${item.color}`,
                        borderRadius: "3px",
                        backgroundColor: "rgba(0,0,0,0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: "14px", opacity: 0.3 }}>📷</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column - Scene Breakdown */}
      <div
        style={{ flex: 1, height: "100%", overflowY: "auto" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2>Scene Breakdown</h2>
          <label style={{ fontSize: "14px" }}>
            <input
              type="checkbox"
              checked={showScenesWithoutProps}
              onChange={(e) => setShowScenesWithoutProps(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Show scenes without props
          </label>
        </div>

        <div>
          {filteredScenes.map((scene, originalIndex) => {
            const sceneIndex = scenes.indexOf(scene);
            const sceneProps = getPropsForScene(sceneIndex);

            return (
              <div
                key={sceneIndex}
                style={{
                  border: "1px solid #ddd",
                  margin: "10px 0",
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: "12px",
                    fontWeight: "bold",
                    fontSize: "14px",
                    borderBottom:
                      sceneProps.length > 0 ? "1px solid #ddd" : "none",
                  }}
                >
                  Scene {scene.sceneNumber}: {scene.heading}
                </div>

                {sceneProps.length > 0 && (
                  <div style={{ padding: "12px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "8px",
                      }}
                    >
                      Props needed ({sceneProps.length}):
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(150px, 1fr))",
                        gap: "6px",
                      }}
                    >
                      {sceneProps.map((prop) => {
                        // Convert hex color to more pastel version
                        const getPastelColor = (hexColor) => {
                          const r = parseInt(hexColor.slice(1, 3), 16);
                          const g = parseInt(hexColor.slice(3, 5), 16);
                          const b = parseInt(hexColor.slice(5, 7), 16);
                          const pastelR = Math.round(r + (255 - r) * 0.7);
                          const pastelG = Math.round(g + (255 - g) * 0.7);
                          const pastelB = Math.round(b + (255 - b) * 0.7);
                          return `rgb(${pastelR}, ${pastelG}, ${pastelB})`;
                        };

                        const assignedCharacters =
                          prop.assignedCharacters || [];
                        const hasMultipleCharacters =
                          assignedCharacters.length > 1;

                        // Capitalize first letter of prop name
                        const capitalizedName =
                          (prop.customTitle || prop.displayName)
                            .charAt(0)
                            .toUpperCase() +
                          (prop.customTitle || prop.displayName).slice(1);

                        return (
                          <div
                            key={`${sceneIndex}-${prop.word}`}
                            onClick={() => handlePropClick(prop, sceneIndex)}
                            onDoubleClick={() =>
                              handlePropDoubleClick(prop, sceneIndex)
                            }
                            style={{
                              backgroundColor: getPastelColor(prop.color),
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              padding: "6px",
                              fontSize: "11px",
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11px", // Back to original size
                                marginBottom: "2px",
                              }}
                            >
                              {propNumberMap[prop.word] ??
                                prop.chronologicalNumber}
                              . {capitalizedName}
                              {hasMultipleCharacters && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    backgroundColor: "#4CAF50",
                                    color: "white",
                                    borderRadius: "50%",
                                    width: "10px",
                                    height: "10px",
                                    textAlign: "center",
                                    fontSize: "7px",
                                    lineHeight: "10px",
                                    marginLeft: "3px",
                                  }}
                                  title="Assigned to multiple characters"
                                >
                                  !
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                color: "#666",
                                marginBottom: "2px",
                                fontSize: "9px",
                              }}
                            >
                              {prop.category}
                            </div>
                            {assignedCharacters.length > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "2px",
                                  marginTop: "2px",
                                }}
                              >
                                {assignedCharacters.map((char) => (
                                  <span
                                    key={char}
                                    style={{
                                      backgroundColor: prop.color,
                                      color: "white",
                                      borderRadius: "8px",
                                      padding: "1px 5px",
                                      fontSize: "8px",
                                      fontWeight: "bold",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {char}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedProp && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 999,
            }}
            onClick={() => setSelectedProp(null)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              border: "2px solid #ccc",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 1000,
              minWidth: "300px",
              maxWidth: "520px",
              width: "90vw",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 0 }}>
                {selectedProp.isNewCustomProp
                  ? "Add Custom Prop"
                  : "Prop Details"}
              </h3>
              {!selectedProp.isNewCustomProp &&
                selectedProp.scenes &&
                selectedProp.scenes.length > 0 && (
                  <button
                    onClick={() => {
                      const firstSceneNumber = selectedProp.scenes[0];
                      setSelectedProp((prev) => ({
                        ...prev,
                        viewingSceneNumber: firstSceneNumber,
                      }));
                      setShowScenePreview(true);
                    }}
                    style={{
                      backgroundColor: "#2196F3",
                      color: "white",
                      padding: "5px 12px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    📄 View Scenes
                  </button>
                )}
            </div>

            {/* Name field */}
            <div style={{ marginBottom: "10px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: "#555",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Prop Name
              </label>
              <input
                type="text"
                value={selectedProp.customTitle || selectedProp.displayName}
                onChange={(e) => {
                  setSelectedProp((prev) => ({
                    ...prev,
                    customTitle: e.target.value,
                  }));
                }}
                onBlur={() => {
                  if (
                    onUpdatePropTitle &&
                    selectedProp.customTitle !== selectedProp.displayName
                  ) {
                    onUpdatePropTitle(
                      selectedProp.word,
                      selectedProp.customTitle
                    );
                  }
                }}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "15px",
                  fontWeight: "bold",
                  boxSizing: "border-box",
                }}
                placeholder="Prop name..."
              />
            </div>

            {/* Search Script — only shown when creating a new custom prop */}
            {selectedProp.isNewCustomProp && (
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  Prop Type
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <select
                    value={selectedProp.propSubcategory || "misc"}
                    onChange={(e) => {
                      const newSub = e.target.value;
                      const newId = generatePropId(newSub);
                      setSelectedProp((prev) => ({ ...prev, propSubcategory: newSub, propId: newId }));
                    }}
                    style={{ flex: 1, padding: "6px 8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px" }}
                  >
                    {PROP_SUBCATEGORIES.map((sub) => (
                      <option key={sub.key} value={sub.key}>{sub.prefix} — {sub.label}</option>
                    ))}
                  </select>
                  {selectedProp.propId && (
                    <span style={{
                      fontSize: "11px", fontWeight: "bold", color: "white",
                      backgroundColor: (SUBCATEGORY_MAP[selectedProp.propSubcategory || "misc"] || SUBCATEGORY_MAP["misc"]).color,
                      borderRadius: "3px", padding: "3px 8px", fontFamily: "monospace", flexShrink: 0,
                    }}>
                      {selectedProp.propId}
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* Script search */}
            {selectedProp.isNewCustomProp && (
              <div
                style={{
                  marginBottom: "14px",
                  padding: "10px",
                  backgroundColor: "#f0f7ff",
                  borderRadius: "6px",
                  border: "1px solid #bbdefb",
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontWeight: "bold",
                    fontSize: "11px",
                    marginBottom: "5px",
                    color: "#1565c0",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Search Script
                </label>
                <input
                  type="text"
                  value={propSearchQuery}
                  autoFocus
                  onChange={(e) => {
                    const val = e.target.value;
                    setPropSearchQuery(val);
                    // Sync prop name from search field (new custom prop only)
                    setSelectedProp((prev) => ({ ...prev, customTitle: val }));
                  }}
                  placeholder="Type word(s) to search script — e.g. 'cigarette holder'"
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #90caf9",
                    borderRadius: "4px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    marginBottom: "6px",
                  }}
                />
                {propSearchResults &&
                  propSearchResults.sceneIndices.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: "12px", color: "#555" }}>
                        Found in{" "}
                        <strong>{propSearchResults.sceneIndices.length}</strong>{" "}
                        scene
                        {propSearchResults.sceneIndices.length !== 1
                          ? "s"
                          : ""}{" "}
                        (
                        {(() => {
                          const count = propSearchResults.sceneIndices.reduce(
                            (sum, si) =>
                              sum +
                              (propSearchResults.instancesByScene[si] || [])
                                .length,
                            0
                          );
                          return `(${count} instance${count !== 1 ? "s" : ""})`;
                        })()}
                      </span>
                      <button
                        onClick={openPropScriptViewer}
                        style={{
                          backgroundColor: "#1976d2",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          padding: "5px 12px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        📄 View &amp; Assign
                      </button>
                    </div>
                  )}
                {propSearchResults &&
                  propSearchResults.sceneIndices.length === 0 &&
                  propSearchQuery && (
                    <div style={{ fontSize: "12px", color: "#e53935" }}>
                      No matches found in script.
                    </div>
                  )}
                {!propSearchQuery && (
                  <div style={{ fontSize: "11px", color: "#90caf9" }}>
                    Supports multi-word phrases (e.g. "cigarette holder")
                  </div>
                )}
              </div>
            )}

            {/* Original word + meta — hide for new custom props to keep it clean */}
            {!selectedProp.isNewCustomProp && (
              <>
                <p style={{ margin: "4px 0", fontSize: "12px" }}>
                  <strong>Original Word:</strong> {selectedProp.displayName}
                </p>
              </>
            )}
            {selectedProp.isNewCustomProp && propSearchQuery && (
              <p
                style={{
                  margin: "4px 0 10px",
                  fontSize: "12px",
                  color: "#555",
                }}
              >
                <strong>Searching for:</strong> "{propSearchQuery}"
              </p>
            )}
            <p style={{ margin: "4px 0", fontSize: "12px" }}>
              <strong>Category:</strong> {selectedProp.category}
            </p>
            {/* Prop Subcategory — editable */}
            <div style={{ margin: "8px 0 6px" }}>
              <label style={{ fontSize: "11px", fontWeight: "bold", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "4px" }}>
                Prop Type
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <select
                  value={selectedProp.propSubcategory || "misc"}
                  disabled={!!(taggedItems[selectedProp.word]?.propIdLocked)}
                  onChange={(e) => {
                    const currentPropData = taggedItems[selectedProp.word] || {};
                    if (currentPropData.propIdLocked) return;
                    const newSub = e.target.value;
                    const newPrefix = (SUBCATEGORY_MAP[newSub] || SUBCATEGORY_MAP["misc"]).prefix;
                    const currentId = currentPropData.propId || "";
                    const newId = currentId.startsWith(newPrefix + "_")
                      ? currentId
                      : generatePropId(newSub);
                    const updated = {
                      ...taggedItems,
                      [selectedProp.word]: {
                        ...currentPropData,
                        propSubcategory: newSub,
                        propId: newId,
                      },
                    };
                    onUpdateTaggedItems(updated);
                    onSyncTaggedItems(updated);
                    setSelectedProp((prev) => ({ ...prev, propSubcategory: newSub, propId: newId }));
                  }}
                  style={{ flex: 1, padding: "6px 8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", opacity: taggedItems[selectedProp.word]?.propIdLocked ? 0.6 : 1 }}
                >
                  {PROP_SUBCATEGORIES.map((sub) => (
                    <option key={sub.key} value={sub.key}>{sub.prefix} — {sub.label}</option>
                  ))}
                </select>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                  {selectedProp.propId ? (
                    <span style={{
                      fontSize: "11px", fontWeight: "bold", color: "white",
                      backgroundColor: (SUBCATEGORY_MAP[selectedProp.propSubcategory || "misc"] || SUBCATEGORY_MAP["misc"]).color,
                      borderRadius: "3px", padding: "3px 8px", fontFamily: "monospace",
                    }}>
                      {selectedProp.propId}
                    </span>
                  ) : (
                    <span style={{ fontSize: "11px", fontWeight: "bold", color: "#888", backgroundColor: "#eee", borderRadius: "3px", padding: "3px 8px", fontFamily: "monospace" }}>
                      unassigned
                    </span>
                  )}
                  {selectedProp.propId && (
                    taggedItems[selectedProp.word]?.propIdLocked ? (
                      <span style={{ fontSize: "11px", fontWeight: "bold", color: "#4CAF50", display: "flex", alignItems: "center", gap: "4px" }}>
                        🔒 ID Locked
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          const currentPropData = taggedItems[selectedProp.word] || {};
                          const updated = {
                            ...taggedItems,
                            [selectedProp.word]: { ...currentPropData, propIdLocked: true },
                          };
                          onUpdateTaggedItems(updated);
                          onSyncTaggedItems(updated);
                          setSelectedProp((prev) => ({ ...prev, propIdLocked: true }));
                        }}
                        title="Verify this ID and lock it permanently"
                        style={{ backgroundColor: "#1976d2", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold", padding: "3px 8px", whiteSpace: "nowrap" }}
                      >
                        Verify & Lock
                      </button>
                    )
                  )}
                </div>
              </div>
              {taggedItems[selectedProp.word]?.propIdLocked && (
                <div style={{ fontSize: "10px", color: "#888", marginTop: "4px", fontStyle: "italic" }}>
                  ID is permanently locked and cannot be changed.
                </div>
              )}
            </div>
            {/* Badge & Print */}
            {!selectedProp.isNewCustomProp && selectedProp.propId && (
              <div style={{ margin: "10px 0", padding: "10px", backgroundColor: "#f0f7ff", borderRadius: "6px", border: "1px solid #bbdefb" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: "#1565c0", textTransform: "uppercase", letterSpacing: "0.05em" }}>🏷 Badge & Print</span>
                  <button onClick={() => setShowBadgeSection(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#1976d2" }}>
                    {showBadgeSection ? "▲ Hide" : "▼ Show"}
                  </button>
                </div>
                {showBadgeSection && (
                  <div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "10px" }}>
                      <img
                        src={getPropQrImgUrl(selectedProp.propId, 90)}
                        alt="QR Code"
                        style={{ width: "90px", height: "90px", border: "1px solid #ddd", borderRadius: "4px", flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "10px", color: "#555", marginBottom: "4px" }}>Scan to open on mobile</div>
                        <div style={{ fontSize: "8px", color: "#999", wordBreak: "break-all", fontFamily: "monospace" }}>
                          {getPropDeepLink(selectedProp.propId)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          if (!printQueue.includes(selectedProp.word)) {
                            setPrintQueue(prev => [...prev, selectedProp.word]);
                          }
                        }}
                        style={{
                          backgroundColor: printQueue.includes(selectedProp.word) ? "#888" : "#1976d2",
                          color: "white", border: "none", borderRadius: "4px",
                          padding: "5px 10px", fontSize: "11px", fontWeight: "bold", cursor: "pointer",
                        }}
                      >
                        {printQueue.includes(selectedProp.word) ? "✓ In Queue" : "+ Add to Queue"}
                      </button>
                      <button
                        onClick={() => exportDymoPdf({ ...taggedItems[selectedProp.word], word: selectedProp.word }, projectSettings?.filmTitle)}
                        style={{ backgroundColor: "#FF9800", color: "white", border: "none", borderRadius: "4px", padding: "5px 10px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        📄 Dymo PDF
                      </button>
                      <button
                        onClick={() => {
                          const xml = generateDymoXml({ ...taggedItems[selectedProp.word], word: selectedProp.word }, projectSettings?.filmTitle);
                          const blob = new Blob([xml], { type: "application/xml" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${selectedProp.propId}_badge.dymo`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={{ backgroundColor: "#9C27B0", color: "white", border: "none", borderRadius: "4px", padding: "5px 10px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        📋 Dymo XML
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <p>
              <strong>Number:</strong>{" "}
              {propNumberMap[selectedProp.word] ??
                selectedProp.chronologicalNumber}
            </p>
            <p>
              <strong>Scenes:</strong>{" "}
              {(() => {
                const liveProp = taggedItems[selectedProp.word];
                const scenes = liveProp?.scenes || selectedProp.scenes || [];
                return scenes.length > 0 ? scenes.join(", ") : "None";
              })()}
            </p>
            <p>
              <strong>Assigned Characters:</strong>{" "}
              {selectedProp.assignedCharacters &&
              selectedProp.assignedCharacters.length > 0
                ? selectedProp.assignedCharacters.join(", ")
                : "None"}
            </p>

            {/* Character Assignment — dropdown */}
            {characters && Object.keys(characters).length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "bold",
                    color: "#555",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Assigned Character
                </label>
                <select
                  value={(selectedProp.assignedCharacters || [])[0] || ""}
                  onChange={(e) => {
                    const selectedChar = e.target.value;
                    const updatedTaggedItems = { ...taggedItems };
                    const propData = updatedTaggedItems[selectedProp.word];
                    if (propData) {
                      const newAssignments = selectedChar ? [selectedChar] : [];
                      // If default character, auto-assign scenes for that character
                      let newScenes = propData.scenes || [];
                      if (selectedChar && propData.defaultCharacter) {
                        const charObj = Object.values(characters).find(
                          (c) => c.name === selectedChar
                        );
                        if (charObj?.scenes) {
                          const charSceneNums = charObj.scenes.map(String);
                          newScenes = [
                            ...new Set([...newScenes, ...charSceneNums]),
                          ];
                        }
                      }
                      updatedTaggedItems[selectedProp.word] = {
                        ...propData,
                        assignedCharacters: newAssignments,
                        scenes: newScenes,
                      };
                      if (onUpdateTaggedItems)
                        onUpdateTaggedItems(updatedTaggedItems);
                      if (onSyncTaggedItems)
                        onSyncTaggedItems(updatedTaggedItems);
                      setSelectedProp((prev) => ({
                        ...prev,
                        assignedCharacters: newAssignments,
                        scenes: newScenes,
                      }));
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">No character assigned</option>
                  {Object.keys(characters)
                    .sort()
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>

                {/* Default Character toggle */}
                {(selectedProp.assignedCharacters || []).length > 0 && (
                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                        color: "#555",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          !!taggedItems[selectedProp.word]?.defaultCharacter
                        }
                        onChange={(e) => {
                          const isDefault = e.target.checked;
                          const updatedTaggedItems = { ...taggedItems };
                          const propData =
                            updatedTaggedItems[selectedProp.word];
                          if (propData) {
                            let newScenes = propData.scenes || [];
                            if (isDefault) {
                              // Snapshot current scenes before expanding so uncheck
                              // can restore them exactly, regardless of instance format
                              const charName = (propData.assignedCharacters ||
                                [])[0];
                              const charObj = Object.values(characters).find(
                                (c) => c.name === charName
                              );
                              if (charObj?.scenes) {
                                const charSceneNums =
                                  charObj.scenes.map(String);
                                newScenes = [
                                  ...new Set([...newScenes, ...charSceneNums]),
                                ];
                              }
                            } else {
                              // Restore the exact scenes that existed before default was checked
                              newScenes =
                                propData.scenesBeforeDefault !== undefined
                                  ? propData.scenesBeforeDefault
                                  : propData.scenes || [];
                            }
                            updatedTaggedItems[selectedProp.word] = {
                              ...propData,
                              defaultCharacter: isDefault,
                              // Store snapshot on check; clear it on uncheck
                              scenesBeforeDefault: isDefault
                                ? propData.scenes || []
                                : undefined,
                              scenes: newScenes,
                            };
                            if (onUpdateTaggedItems)
                              onUpdateTaggedItems(updatedTaggedItems);
                            if (onSyncTaggedItems)
                              onSyncTaggedItems(updatedTaggedItems);
                            setSelectedProp((prev) => ({
                              ...prev,
                              defaultCharacter: isDefault,
                              scenes: newScenes,
                            }));
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      />
                      <span>Default prop for this character</span>
                    </label>
                    {!!taggedItems[selectedProp.word]?.defaultCharacter && (
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#4CAF50",
                          fontWeight: "bold",
                        }}
                      >
                        ✓ Auto-assigned to all character scenes
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Photos section — only for saved props */}
            {!selectedProp.isNewCustomProp && (
              <div
                style={{
                  marginTop: "14px",
                  padding: "10px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "6px",
                  border: "1px solid #eee",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: "#555",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Photos ({(selectedProp.photos || []).length}/10)
                  </label>
                  {(selectedProp.photos || []).length < 10 && (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        id={`prop-photo-upload-${selectedProp.word}`}
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file || !onUploadPropImage) return;
                          setPropImageUploading(true);
                          try {
                            const url = await onUploadPropImage(
                              selectedProp.word,
                              file
                            );
                            if (url) {
                              const newPhotos = [
                                ...(selectedProp.photos || []),
                                url,
                              ];
                              const updatedItems = {
                                ...taggedItems,
                                [selectedProp.word]: {
                                  ...taggedItems[selectedProp.word],
                                  photos: newPhotos,
                                },
                              };
                              onUpdateTaggedItems(updatedItems);
                              onSyncTaggedItems(updatedItems);
                              setSelectedProp((prev) => ({
                                ...prev,
                                photos: newPhotos,
                              }));
                            }
                          } finally {
                            setPropImageUploading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                      <button
                        disabled={propImageUploading}
                        onClick={() =>
                          document
                            .getElementById(
                              `prop-photo-upload-${selectedProp.word}`
                            )
                            .click()
                        }
                        style={{
                          backgroundColor: propImageUploading
                            ? "#aaa"
                            : "#4CAF50",
                          color: "white",
                          border: "none",
                          padding: "5px 12px",
                          borderRadius: "4px",
                          cursor: propImageUploading
                            ? "not-allowed"
                            : "pointer",
                          fontSize: "11px",
                          fontWeight: "bold",
                        }}
                      >
                        {propImageUploading ? "Uploading…" : "+ Upload Photo"}
                      </button>
                    </>
                  )}
                </div>

                {(selectedProp.photos || []).length > 0 ? (
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                  >
                    {(selectedProp.photos || []).map((photo, idx) => (
                      <div key={idx} style={{ position: "relative" }}>
                        <img
                          src={photo}
                          alt={`Prop photo ${idx + 1}`}
                          onClick={() => setLightboxImage(photo)}
                          style={{
                            width: "80px",
                            height: "80px",
                            objectFit: "cover",
                            border: `5px solid ${selectedProp.color}`,
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        />
                        <button
                          onClick={async () => {
                            if (!onDeletePropImage) return;
                            await onDeletePropImage(photo);
                            const newPhotos = (
                              selectedProp.photos || []
                            ).filter((_, i) => i !== idx);
                            const updatedItems = {
                              ...taggedItems,
                              [selectedProp.word]: {
                                ...taggedItems[selectedProp.word],
                                photos: newPhotos,
                              },
                            };
                            onUpdateTaggedItems(updatedItems);
                            onSyncTaggedItems(updatedItems);
                            setSelectedProp((prev) => ({
                              ...prev,
                              photos: newPhotos,
                            }));
                          }}
                          style={{
                            position: "absolute",
                            top: "-6px",
                            right: "-6px",
                            backgroundColor: "#f44336",
                            color: "white",
                            border: "none",
                            borderRadius: "50%",
                            width: "20px",
                            height: "20px",
                            fontSize: "14px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#aaa",
                      margin: 0,
                      fontStyle: "italic",
                    }}
                  >
                    No photos yet — click Upload Photo above.
                  </p>
                )}
              </div>
            )}

            {/* Scene Context Actions - only show if opened from scene context */}
            {selectedProp.contextScene !== null && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0" }}>Scene Actions</h4>
                <button
                  onClick={() => {
                    if (onRemovePropFromScene) {
                      onRemovePropFromScene(
                        selectedProp.word,
                        selectedProp.contextScene
                      );
                    }
                    setSelectedProp(null);
                  }}
                  style={{
                    backgroundColor: "#f44336",
                    color: "white",
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "8px",
                    fontSize: "12px",
                  }}
                >
                  Remove from Scene
                </button>
                <button
                  onClick={() => {
                    const variantName = prompt(
                      `Create variant of "${
                        selectedProp.customTitle || selectedProp.displayName
                      }":`
                    );
                    if (variantName && onCreatePropVariant) {
                      onCreatePropVariant(selectedProp.word, variantName);
                    }
                  }}
                  style={{
                    backgroundColor: "#FF9800",
                    color: "white",
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "8px",
                    fontSize: "12px",
                  }}
                >
                  Create Variant
                </button>
              </div>
            )}

            {/* Add to Scenes - show for both contexts */}
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#e8f5e8",
                borderRadius: "4px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0" }}>
                {selectedProp.contextScene !== null
                  ? "Add Props to Scene"
                  : "Manage Scenes for This Prop"}
              </h4>

              {selectedProp.contextScene === null ? (
                <div>
                  <div
                    style={{
                      marginBottom: "8px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    Click a scene to add or remove this prop.
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px",
                      maxHeight: "120px",
                      overflowY: "auto",
                    }}
                  >
                    {scenes.map((scene, sceneIndex) => {
                      const liveProp = taggedItems[selectedProp.word];
                      const isAssigned = (
                        liveProp?.scenes ||
                        selectedProp.scenes ||
                        []
                      ).some((s) => String(s) === String(scene.sceneNumber));
                      return (
                        <button
                          key={sceneIndex}
                          onClick={() => {
                            if (isAssigned) {
                              if (onRemovePropFromScene)
                                onRemovePropFromScene(
                                  selectedProp.word,
                                  sceneIndex
                                );
                            } else {
                              if (onAddPropToScene)
                                onAddPropToScene(selectedProp.word, sceneIndex);
                            }
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: "11px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            cursor: "pointer",
                            backgroundColor: isAssigned ? "#4CAF50" : "#f5f5f5",
                            color: isAssigned ? "white" : "#333",
                            fontWeight: isAssigned ? "bold" : "normal",
                          }}
                        >
                          {scene.sceneNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Scene context - add other props to this scene
                <div>
                  <select
                    style={{
                      padding: "4px 8px",
                      marginRight: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                    onChange={(e) => {
                      if (e.target.value && onAddPropToScene) {
                        onAddPropToScene(
                          e.target.value,
                          selectedProp.contextScene
                        );
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Select existing prop...</option>
                    {propItems.map(([word, item]) => (
                      <option key={word} value={word}>
                        {item.customTitle || item.displayName}
                      </option>
                    ))}
                  </select>
                  <br />
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      marginTop: "8px",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Create new prop..."
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        fontSize: "12px",
                        width: "150px",
                      }}
                      onKeyPress={(e) => {
                        if (
                          e.key === "Enter" &&
                          e.target.value.trim() &&
                          onCreateNewProp
                        ) {
                          onCreateNewProp(
                            e.target.value.trim(),
                            selectedProp.contextScene
                          );
                          e.target.value = "";
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input =
                          e.target.parentElement.querySelector("input");
                        if (input.value.trim() && onCreateNewProp) {
                          onCreateNewProp(
                            input.value.trim(),
                            selectedProp.contextScene
                          );
                          input.value = "";
                        }
                      }}
                      style={{
                        backgroundColor: "#4CAF50",
                        color: "white",
                        padding: "4px 8px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Create Variant - show for both contexts */}
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#fff3e0",
                borderRadius: "4px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0" }}>Prop Management</h4>
              <button
                onClick={() => {
                  const variantName = prompt(
                    `Create variant of "${
                      selectedProp.customTitle || selectedProp.displayName
                    }":`
                  );
                  if (variantName && onCreatePropVariant) {
                    onCreatePropVariant(selectedProp.word, variantName);
                  }
                }}
                style={{
                  backgroundColor: "#FF9800",
                  color: "white",
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Create Variant
              </button>
            </div>

            <div style={{ marginTop: "15px" }}>
              {selectedProp.contextScene !== null &&
                !selectedProp.isNewCustomProp && (
                  <button
                    onClick={() => setShowScenePreview(true)}
                    style={{
                      backgroundColor: "#2196F3",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      marginRight: "10px",
                    }}
                  >
                    View Scene
                  </button>
                )}

              {selectedProp.isNewCustomProp && (
                <div style={{ marginBottom: "10px" }}>
                  {/* Show confirmed scenes from viewer */}
                  {getConfirmedScenes().length > 0 && (
                    <div
                      style={{
                        marginBottom: "10px",
                        padding: "8px",
                        backgroundColor: "#e8f5e9",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                    >
                      <strong style={{ color: "#2e7d32" }}>
                        Confirmed scenes:
                      </strong>{" "}
                      {getConfirmedScenes().join(", ")}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => {
                        if (
                          selectedProp.customTitle?.trim() &&
                          onCreateNewProp
                        ) {
                          const confirmedScenes = getConfirmedScenes();

                          // Group confirmed scenes by character assignment
                          // Scenes with no character go on the main prop
                          // Scenes with a character get added to that character's variant if one was created
                          const scenesByCharacter = {};
                          const mainPropScenes = [];

                          if (propSearchResults) {
                            const { instancesByScene, sceneIndices } =
                              propSearchResults;
                            sceneIndices.forEach((si) => {
                              const instances = instancesByScene[si] || [];
                              const confirmedInst = instances.filter(
                                (id) => instanceStatuses[id] === "confirmed"
                              );
                              if (confirmedInst.length === 0) return;
                              const sceneNum = scenes[si]?.sceneNumber;
                              if (!sceneNum) return;

                              // Check if any instance in this scene has a character or variant
                              const char = confirmedInst
                                .map((id) => instanceCharacters[id])
                                .find(Boolean);
                              const variant = confirmedInst
                                .map((id) => instanceVariants[id])
                                .find(Boolean);

                              if (!char || char === primarySessionChar) {
                                // No character or primary character → main prop
                                // (variants for additional chars were already created live)
                                mainPropScenes.push(sceneNum);
                              }
                              // else: non-primary char — variant already handles this scene
                            });
                          } else {
                            mainPropScenes.push(...confirmedScenes);
                          }

                          // Create main prop with primary character's scenes
                          // Variants were already created live during the viewer session
                          const mainCharObj = primarySessionChar
                            ? { [primarySessionChar]: primarySessionChar }
                            : null;
                          const newWord = onCreateNewProp(
                            selectedProp.customTitle.trim(),
                            null,
                            mainPropScenes,
                            mainCharObj
                          );
                          // Patch subcategory + propId onto newly created prop
                          if (newWord && (selectedProp.propSubcategory || selectedProp.propId)) {
                            setTimeout(() => {
                              const latest = { ...taggedItems };
                              if (latest[newWord]) {
                                latest[newWord] = {
                                  ...latest[newWord],
                                  propSubcategory: selectedProp.propSubcategory || "misc",
                                  propId: selectedProp.propId || generatePropId(selectedProp.propSubcategory || "misc"),
                                  propIdLocked: false,
                                };
                                onUpdateTaggedItems(latest);
                                onSyncTaggedItems(latest);
                              }
                            }, 100);
                          }
                        }
                        closePropPopup();
                      }}
                      style={{
                        backgroundColor: "#4CAF50",
                        color: "white",
                        padding: "8px 16px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      Save Prop
                    </button>
                    <button
                      onClick={closePropPopup}
                      style={{
                        backgroundColor: "#f44336",
                        color: "white",
                        padding: "8px 16px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!selectedProp.isNewCustomProp && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={async () => {
                      const confirmed = showConfirm
                        ? await showConfirm(
                            `Delete "${
                              selectedProp.customTitle ||
                              selectedProp.displayName
                            }"?\n\nThis cannot be undone.`,
                            "Delete",
                            "Cancel"
                          )
                        : window.confirm(
                            `Delete "${
                              selectedProp.customTitle ||
                              selectedProp.displayName
                            }"? This cannot be undone.`
                          );
                      if (confirmed) {
                        // Build updated set without the deleted prop
                        const afterDelete = { ...taggedItems };
                        delete afterDelete[selectedProp.word];

                        // Renumber chronologicalNumber sequentially by current order
                        const reordered = Object.entries(afterDelete).sort(
                          (a, b) =>
                            (a[1].chronologicalNumber || 0) -
                            (b[1].chronologicalNumber || 0)
                        );
                        const renumbered = {};
                        reordered.forEach(([word, item], idx) => {
                          renumbered[word] = {
                            ...item,
                            chronologicalNumber: idx + 1,
                          };
                        });

                        // Update state + sync renumbered set first
                        if (onUpdateTaggedItems)
                          onUpdateTaggedItems(renumbered);
                        if (onSyncTaggedItems) onSyncTaggedItems(renumbered);

                        // Then call onDeleteProp purely for the DB row deletion
                        if (onDeleteProp) onDeleteProp(selectedProp.word);
                        setSelectedProp(null);
                      }
                    }}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    🗑 Delete Prop
                  </button>
                  <button
                    onClick={() => setSelectedProp(null)}
                    style={{
                      backgroundColor: "#ccc",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Print Queue Modal */}
      {showPrintQueue && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.55)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "white", borderRadius: "8px", width: "640px", maxWidth: "95vw", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>

            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>🖨 Print Queue ({printQueue.length} prop{printQueue.length !== 1 ? "s" : ""})</h3>
              <button onClick={() => setShowPrintQueue(false)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#666" }}>×</button>
            </div>

            {/* Format selector */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #eee" }}>
              <label style={{ fontSize: "11px", fontWeight: "bold", color: "#555", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Label Format</label>
              <select value={printFormat} onChange={(e) => { setPrintFormat(e.target.value); setUsedSlots([]); }}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px" }}>
                <option value="avery5163">Avery 5163 — 2" × 4" shipping label (10/sheet, 2×5)</option>
                <option value="avery5160">Avery 5160 — 1" × 2⅝" address label (30/sheet, 3×10)</option>
                <option value="dymo">Dymo LW Durable — 2¼" × 1¼" (export per label)</option>
              </select>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {printQueue.length === 0 ? (
                <div style={{ color: "#888", textAlign: "center", padding: "40px", fontStyle: "italic" }}>
                  No props in queue. Open a prop's Manage popup and click "+ Add to Queue".
                </div>
              ) : (
                <>
                  {/* Queue list */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", textTransform: "uppercase", marginBottom: "8px" }}>Props in Queue</div>
                    {printQueue.map(word => {
                      const item = taggedItems[word];
                      if (!item) return null;
                      const subMeta = SUBCATEGORY_MAP[item.propSubcategory || "misc"] || SUBCATEGORY_MAP["misc"];
                      return (
                        <div key={word} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", backgroundColor: "#f9f9f9", borderRadius: "4px", marginBottom: "4px" }}>
                          {item.propId && <span style={{ fontSize: "9px", fontWeight: "bold", color: "white", backgroundColor: subMeta.color, borderRadius: "3px", padding: "1px 5px", fontFamily: "monospace", flexShrink: 0 }}>{item.propId}</span>}
                          <span style={{ flex: 1, fontSize: "13px", fontWeight: "500" }}>{item.customTitle || item.displayName}</span>
                          {printFormat === "dymo" && (
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button onClick={() => exportDymoPdf({ ...item, word }, projectSettings?.filmTitle)}
                                style={{ backgroundColor: "#FF9800", color: "white", border: "none", borderRadius: "3px", padding: "3px 8px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}>PDF</button>
                              <button onClick={() => {
                                const xml = generateDymoXml({ ...item, word }, projectSettings?.filmTitle);
                                const blob = new Blob([xml], { type: "application/xml" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a"); a.href = url;
                                a.download = `${item.propId || "prop"}_badge.dymo`; a.click();
                                URL.revokeObjectURL(url);
                              }} style={{ backgroundColor: "#9C27B0", color: "white", border: "none", borderRadius: "3px", padding: "3px 8px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}>XML</button>
                            </div>
                          )}
                          <button onClick={() => setPrintQueue(prev => prev.filter(w => w !== word))}
                            style={{ backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "3px", padding: "3px 8px", fontSize: "10px", cursor: "pointer" }}>✕</button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Avery: slot grid + export */}
                  {printFormat !== "dymo" && (() => {
                    const cfg = { avery5163: { cols: 2, rows: 5, total: 10, slotH: "52px" }, avery5160: { cols: 3, rows: 10, total: 30, slotH: "26px" } }[printFormat];
                    const availSlots = Array.from({ length: cfg.total }, (_, i) => i).filter(i => !usedSlots.includes(i));
                    const availCount = availSlots.length;
                    return (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", textTransform: "uppercase" }}>Sheet Layout</div>
                          <div style={{ fontSize: "10px", color: "#888" }}>
                            {availCount} slot{availCount !== 1 ? "s" : ""} available · {printQueue.length} in queue
                            {printQueue.length > availCount && <span style={{ color: "#e53935", marginLeft: "6px" }}>⚠ More props than slots</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: "10px", color: "#888", marginBottom: "8px" }}>Click a slot to mark it as already-used (gray = skip).</div>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cfg.cols}, 1fr)`, gap: "3px", marginBottom: "16px", padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "6px" }}>
                          {Array.from({ length: cfg.total }, (_, i) => {
                            const isUsed = usedSlots.includes(i);
                            const pIdx = availSlots.indexOf(i);
                            const assignedProp = !isUsed && pIdx >= 0 && pIdx < printQueue.length ? taggedItems[printQueue[pIdx]] : null;
                            return (
                              <div key={i}
                                onClick={() => setUsedSlots(prev => prev.includes(i) ? prev.filter(s => s !== i) : [...prev, i])}
                                title={isUsed ? `Slot ${i+1}: skipped — click to restore` : assignedProp ? `Slot ${i+1}: ${assignedProp.customTitle || assignedProp.displayName}` : `Slot ${i+1}: empty`}
                                style={{
                                  height: cfg.slotH, backgroundColor: isUsed ? "#ddd" : assignedProp ? `${assignedProp.color}30` : "white",
                                  border: `1px solid ${isUsed ? "#bbb" : "#ddd"}`, borderRadius: "2px", cursor: "pointer",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "8px", fontWeight: "bold", color: isUsed ? "#aaa" : "#777",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "2px 4px",
                                }}>
                                {isUsed ? "✕" : assignedProp ? (assignedProp.propId || (assignedProp.customTitle || assignedProp.displayName).slice(0, 10)) : <span style={{ color: "#ddd" }}>{i+1}</span>}
                              </div>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => {
                            const propsToExport = printQueue.map(w => ({ ...taggedItems[w], word: w })).filter(Boolean);
                            const html = generateBadgePrintHtml(propsToExport, printFormat, usedSlots, projectSettings?.filmTitle);
                            const win = window.open("", "_blank");
                            win.document.write(html);
                            win.document.close();
                          }}
                          disabled={printQueue.length === 0}
                          style={{ width: "100%", padding: "10px", backgroundColor: printQueue.length === 0 ? "#ccc" : "#1976d2", color: "white", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "bold", cursor: printQueue.length === 0 ? "not-allowed" : "pointer" }}
                        >
                          🖨 Export & Print PDF
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => { setPrintQueue([]); setUsedSlots([]); }}
                style={{ background: "none", border: "1px solid #f44336", color: "#f44336", borderRadius: "4px", padding: "5px 14px", cursor: "pointer", fontSize: "12px" }}>
                Clear Queue
              </button>
              <button onClick={() => setShowPrintQueue(false)}
                style={{ backgroundColor: "#555", color: "white", border: "none", borderRadius: "4px", padding: "5px 18px", cursor: "pointer", fontSize: "12px" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Props Script Viewer — for new custom prop search & confirm */}
      {selectedProp?.isNewCustomProp &&
        showPropScriptViewer &&
        propSearchResults &&
        (() => {
          const { instancesByScene, sceneIndices } = propSearchResults;
          const currentSceneIndex = showFullScriptViewer
            ? fullScriptSceneIdx
            : sceneIndices[propViewerSceneIdx];
          const scene = scenes[currentSceneIndex];
          const currentInstances = instancesByScene[currentSceneIndex] || [];
          const currentInstanceId = currentInstances[propViewerInstanceIdx];
          const propColor = selectedProp?.color || "#4CAF50";

          if (!scene) return null;

          const confirmedInScene = currentInstances.filter(
            (id) => instanceStatuses[id] === "confirmed"
          ).length;
          const pendingInScene = currentInstances.filter(
            (id) =>
              instanceStatuses[id] !== "rejected" &&
              instanceStatuses[id] !== "confirmed"
          ).length;

          return (
            <>
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  backgroundColor: "rgba(0,0,0,0.7)",
                  zIndex: 1100,
                }}
                onClick={() => {
                  setInstancePopup(null);
                  setShowPropScriptViewer(false);
                }}
              />
              <div
                style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                  backgroundColor: "white",
                  width: "90%",
                  maxWidth: "9.28in",
                  height: "85%",
                  borderRadius: "8px",
                  overflow: "hidden",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  zIndex: 1101,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Viewer Header */}
                <div
                  style={{
                    backgroundColor: "#1976d2",
                    color: "white",
                    padding: "12px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    {/* Scene prev/next — full script mode navigates all scenes;
                        normal mode navigates tagged scenes only */}
                    <button
                      onClick={() => {
                        if (showFullScriptViewer) {
                          setFullScriptSceneIdx((prev) => Math.max(0, prev - 1));
                        } else {
                          setPropViewerSceneIdx(
                            Math.max(0, propViewerSceneIdx - 1)
                          );
                          setPropViewerInstanceIdx(0);
                        }
                        setInstancePopup(null);
                      }}
                      disabled={
                        showFullScriptViewer
                          ? fullScriptSceneIdx === 0
                          : propViewerSceneIdx === 0
                      }
                      style={{
                        backgroundColor:
                          (showFullScriptViewer
                            ? fullScriptSceneIdx === 0
                            : propViewerSceneIdx === 0)
                            ? "#ccc"
                            : "white",
                        color:
                          (showFullScriptViewer
                            ? fullScriptSceneIdx === 0
                            : propViewerSceneIdx === 0)
                            ? "#888"
                            : "#1976d2",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: "3px",
                        cursor:
                          (showFullScriptViewer
                            ? fullScriptSceneIdx === 0
                            : propViewerSceneIdx === 0)
                            ? "not-allowed"
                            : "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      ← Scene
                    </button>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: "bold", fontSize: "13px" }}>
                        {showFullScriptViewer ? (
                          <>Scene {scene.sceneNumber} ({fullScriptSceneIdx + 1}/{scenes.length})</>
                        ) : (
                          <>Scene {scene.sceneNumber} ({propViewerSceneIdx + 1}/{sceneIndices.length})</>
                        )}
                      </div>
                      <div style={{ fontSize: "10px", opacity: 0.8 }}>
                        {showFullScriptViewer
                          ? currentInstances.length > 0
                            ? `${confirmedInScene} confirmed · ${pendingInScene} pending`
                            : "no instances in this scene"
                          : `${confirmedInScene} confirmed · ${pendingInScene} pending`}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (showFullScriptViewer) {
                          setFullScriptSceneIdx((prev) =>
                            Math.min(scenes.length - 1, prev + 1)
                          );
                        } else {
                          setPropViewerSceneIdx(
                            Math.min(
                              sceneIndices.length - 1,
                              propViewerSceneIdx + 1
                            )
                          );
                          setPropViewerInstanceIdx(0);
                        }
                        setInstancePopup(null);
                      }}
                      disabled={
                        showFullScriptViewer
                          ? fullScriptSceneIdx === scenes.length - 1
                          : propViewerSceneIdx === sceneIndices.length - 1
                      }
                      style={{
                        backgroundColor:
                          (showFullScriptViewer
                            ? fullScriptSceneIdx === scenes.length - 1
                            : propViewerSceneIdx === sceneIndices.length - 1)
                            ? "#ccc"
                            : "white",
                        color:
                          (showFullScriptViewer
                            ? fullScriptSceneIdx === scenes.length - 1
                            : propViewerSceneIdx === sceneIndices.length - 1)
                            ? "#888"
                            : "#1976d2",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: "3px",
                        cursor:
                          (showFullScriptViewer
                            ? fullScriptSceneIdx === scenes.length - 1
                            : propViewerSceneIdx === sceneIndices.length - 1)
                            ? "not-allowed"
                            : "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      Scene →
                    </button>

                    <div
                      style={{
                        width: "1px",
                        backgroundColor: "rgba(255,255,255,0.3)",
                        alignSelf: "stretch",
                        margin: "0 4px",
                      }}
                    />

                    {/* Instance prev/next */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const prevIdx = Math.max(0, propViewerInstanceIdx - 1);
                        setPropViewerInstanceIdx(prevIdx);
                        // Auto-open popup for the previous instance so it can be changed
                        const prevInstanceId = currentInstances[prevIdx];
                        if (prevInstanceId) {
                          const preChar =
                            instanceCharacters[prevInstanceId] ||
                            lastChosenChar ||
                            "";
                          setInstancePopupCharInput(preChar);
                          setInstancePopupVariantInput("");
                          setInstancePopup(prevInstanceId);
                        } else {
                          setInstancePopup(null);
                        }
                      }}
                      disabled={propViewerInstanceIdx === 0}
                      style={{
                        backgroundColor:
                          propViewerInstanceIdx === 0 ? "#ccc" : "white",
                        color: propViewerInstanceIdx === 0 ? "#888" : "#1976d2",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: "3px",
                        cursor:
                          propViewerInstanceIdx === 0
                            ? "not-allowed"
                            : "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      ← Word
                    </button>
                    <div style={{ fontSize: "11px" }}>
                      Word {propViewerInstanceIdx + 1}/{currentInstances.length}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPropViewerInstanceIdx(
                          Math.min(
                            currentInstances.length - 1,
                            propViewerInstanceIdx + 1
                          )
                        );
                        setInstancePopup(null);
                      }}
                      disabled={
                        propViewerInstanceIdx === currentInstances.length - 1
                      }
                      style={{
                        backgroundColor:
                          propViewerInstanceIdx === currentInstances.length - 1
                            ? "#ccc"
                            : "white",
                        color:
                          propViewerInstanceIdx === currentInstances.length - 1
                            ? "#888"
                            : "#1976d2",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: "3px",
                        cursor:
                          propViewerInstanceIdx === currentInstances.length - 1
                            ? "not-allowed"
                            : "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      Word →
                    </button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        color: "white",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={showFullScriptViewer}
                        onChange={(e) => {
                          const turningOn = e.target.checked;
                          setShowFullScriptViewer(turningOn);
                          setInstancePopup(null);
                          if (turningOn) {
                            setFullScriptSceneIdx(currentSceneIndex);
                          } else {
                            // Snap back to the tagged scene closest to current full-script position
                            let closestIdx = 0;
                            let closestDist = Infinity;
                            sceneIndices.forEach((si, idx) => {
                              const dist = Math.abs(si - fullScriptSceneIdx);
                              if (dist < closestDist) {
                                closestDist = dist;
                                closestIdx = idx;
                              }
                            });
                            setPropViewerSceneIdx(closestIdx);
                            setPropViewerInstanceIdx(0);
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      />
                      Show full script
                    </label>
                    <button
                      onClick={() => {
                        setShowPropScriptViewer(false);
                        setInstancePopup(null);
                        setShowFullScriptViewer(false);
                      }}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.2)",
                        border: "1px solid rgba(255,255,255,0.5)",
                        color: "white",
                        fontSize: "13px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        padding: "6px 14px",
                        borderRadius: "4px",
                      }}
                    >
                      ✓ Done
                    </button>
                  </div>
                </div>

                {/* Scene heading strip */}
                <div
                  style={{
                    padding: "8px 20px",
                    backgroundColor: "#f5f5f5",
                    borderBottom: "1px solid #ddd",
                    fontFamily: "Courier New, monospace",
                    fontWeight: "bold",
                    fontSize: "11pt",
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  {scene.heading}
                </div>

                {/* Script content */}
                <div
                  ref={propViewerScrollRef}
                  style={{
                    flex: 1,
                    padding: "1.5in",
                    overflow: "auto",
                    backgroundColor: "white",
                    boxSizing: "border-box",
                    fontFamily: "Courier New, monospace",
                    position: "relative",
                  }}
                  onClick={() => setInstancePopup(null)}
                >
                  <div style={{ marginBottom: 0 }}>
                    <div style={getElementStyle("Scene Heading")}>
                      {scene.heading}
                    </div>
                  {(scene.content || []).map((block, bi) => {
                    const words = block.text.split(/(\s+)/);
                    return (
                      <div key={bi} style={getElementStyle(block.type)}>
                        {words.map((word, wi) => {
                          if (!word.trim()) return word;
                          const instanceId = `${currentSceneIndex}-${bi}-${wi}`;
                          const isInResults =
                            currentInstances.includes(instanceId) ||
                            currentInstances.some((id) =>
                              (instancesByScene[`_group_${id}`] || []).includes(
                                instanceId
                              )
                            );
                          const primaryForThis = currentInstances.find((id) =>
                            (instancesByScene[`_group_${id}`] || [id]).includes(
                              instanceId
                            )
                          );
                          const isCurrent =
                            (primaryForThis || instanceId) ===
                            currentInstanceId;
                          const status =
                            instanceStatuses[primaryForThis || instanceId];
                          const charAssigned =
                            instanceCharacters[primaryForThis || instanceId];
                          const variantAssigned =
                            instanceVariants[primaryForThis || instanceId];

                          if (!isInResults) return word;

                          const bgColor =
                            status === "confirmed"
                              ? propColor
                              : status === "rejected"
                              ? "#bdbdbd"
                              : isCurrent
                              ? propColor
                              : "#a5d6a7";
                          const opacity =
                            status === "rejected" ? 0.4 : isCurrent ? 1 : 0.65;

                          return (
                            <span
                              key={wi}
                              ref={isCurrent ? propViewerCurrentRef : null}
                              style={{
                                position: "relative",
                                display: "inline",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const effectiveId =
                                  primaryForThis || instanceId;
                                const instIdx =
                                  currentInstances.indexOf(effectiveId);
                                if (instIdx >= 0)
                                  setPropViewerInstanceIdx(instIdx);
                                setInstancePopup(
                                  instancePopup === effectiveId
                                    ? null
                                    : effectiveId
                                );
                                setInstancePopupVariantInput("");
                                setInstancePopupMultiSelect(false);
                                setInstancePopupMultiChars([]);
                                setInstancePopupCharDropdownOpen(false);
                                // Pre-populate with this instance's assigned character,
                                // or the most recently chosen character
                                const preChar =
                                  instanceCharacters[effectiveId] ||
                                  lastChosenChar ||
                                  "";
                                setInstancePopupCharInput(preChar);
                              }}
                            >
                              {/* Character/variant badge */}
                              {(charAssigned || variantAssigned) && (
                                <span
                                  style={{
                                    position: "absolute",
                                    top: "-14px",
                                    left: 0,
                                    backgroundColor: "#FF9800",
                                    color: "white",
                                    fontSize: "8px",
                                    padding: "1px 4px",
                                    borderRadius: "3px",
                                    whiteSpace: "nowrap",
                                    zIndex: 10,
                                    pointerEvents: "none",
                                  }}
                                >
                                  {variantAssigned || charAssigned}
                                </span>
                              )}
                              <span
                                style={{
                                  backgroundColor: bgColor,
                                  color:
                                    status === "rejected" ? "#666" : "white",
                                  padding: "2px 4px",
                                  borderRadius: "3px",
                                  fontWeight: isCurrent ? "bold" : "normal",
                                  opacity,
                                  cursor: "pointer",
                                  border: isCurrent
                                    ? "2px solid #0d47a1"
                                    : "none",
                                }}
                              >
                                {word}
                              </span>

                              {/* Instance mini popup */}
                              {instancePopup ===
                                (primaryForThis || instanceId) &&
                                instanceId ===
                                  (primaryForThis || instanceId) && (
                                  <span
                                    style={{
                                      position: "absolute",
                                      top: "24px",
                                      left: 0,
                                      backgroundColor: "white",
                                      border: "2px solid #1976d2",
                                      borderRadius: "6px",
                                      padding: "10px",
                                      zIndex: 1200,
                                      minWidth: "220px",
                                      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "6px",
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div
                                      style={{
                                        fontWeight: "bold",
                                        fontSize: "11px",
                                        color: "#1976d2",
                                        marginBottom: "2px",
                                      }}
                                    >
                                      "{word}" — {scene.sceneNumber}
                                    </div>

                                    {/* Confirm / Reject */}
                                    <div
                                      style={{ display: "flex", gap: "6px" }}
                                    >
                                      <button
                                        onClick={() => {
                                          // Build the list of chars to apply:
                                          // multi-select mode uses the checklist,
                                          // single mode uses the dropdown value
                                          const charsToApply =
                                            instancePopupMultiSelect
                                              ? instancePopupMultiChars
                                              : instancePopupCharInput
                                              ? [instancePopupCharInput]
                                              : [];

                                          if (charsToApply.length > 0) {
                                            const primaryChar = charsToApply[0];
                                            const updatedChars = {
                                              ...instanceCharacters,
                                              [instanceId]: primaryChar,
                                            };
                                            setLastChosenChar(primaryChar);

                                            // Resolve primary session char
                                            const effectivePrimary =
                                              primarySessionChar || primaryChar;
                                            if (!primarySessionChar) {
                                              setPrimarySessionChar(
                                                primaryChar
                                              );
                                            }

                                            // Build all additional variant updates in one
                                            // batch to avoid stale taggedItems overwrites
                                            // from sequential onCreateNewProp calls
                                            const additionalChars =
                                              charsToApply.filter(
                                                (c) => c !== effectivePrimary
                                              );

                                            if (additionalChars.length > 0) {
                                              const batchedItems = {
                                                ...taggedItems,
                                              };
                                              const newVariantWords = {};
                                              let nextNum =
                                                Object.keys(batchedItems)
                                                  .length + 1;

                                              for (const char of additionalChars) {
                                                setInstanceVariants((prev) => ({
                                                  ...prev,
                                                  [instanceId]: char,
                                                }));
                                                const existingWord =
                                                  sessionVariants[char] ||
                                                  newVariantWords[char];
                                                if (
                                                  existingWord &&
                                                  batchedItems[existingWord]
                                                ) {
                                                  // Reuse: add scene to existing variant
                                                  const variantItem =
                                                    batchedItems[existingWord];
                                                  const sceneNum =
                                                    scene.sceneNumber;
                                                  const currentScenes =
                                                    variantItem.scenes || [];
                                                  if (
                                                    !currentScenes
                                                      .map(String)
                                                      .includes(
                                                        String(sceneNum)
                                                      )
                                                  ) {
                                                    batchedItems[existingWord] =
                                                      {
                                                        ...variantItem,
                                                        scenes: [
                                                          ...currentScenes,
                                                          sceneNum,
                                                        ],
                                                      };
                                                  }
                                                } else {
                                                  // New variant — build inline so all
                                                  // chars share the same batchedItems base
                                                  const cleanWord = `custom_prop_${(
                                                    selectedProp.customTitle ||
                                                    "Prop"
                                                  )
                                                    .toLowerCase()
                                                    .replace(
                                                      /[^\w]/g,
                                                      "_"
                                                    )}_${char
                                                    .replace(/\s+/g, "_")
                                                    .toLowerCase()}_${Date.now()}_${Math.random()
                                                    .toString(36)
                                                    .slice(2, 6)}`;
                                                  batchedItems[cleanWord] = {
                                                    displayName:
                                                      selectedProp.customTitle ||
                                                      selectedProp.displayName ||
                                                      "Prop",
                                                    category: "Props",
                                                    color:
                                                      Object.values(
                                                        taggedItems
                                                      ).find(
                                                        (item) =>
                                                          item.category ===
                                                          "Props"
                                                      )?.color ||
                                                      selectedProp.color ||
                                                      "#FF6B6B",
                                                    chronologicalNumber:
                                                      nextNum++,
                                                    position: 0,
                                                    scenes: [scene.sceneNumber],
                                                    instances: [
                                                      `manual-${Date.now()}`,
                                                    ],
                                                    customTitle:
                                                      selectedProp.customTitle ||
                                                      selectedProp.displayName ||
                                                      "Prop",
                                                    manuallyCreated: true,
                                                    assignedCharacters: [char],
                                                  };
                                                  newVariantWords[char] =
                                                    cleanWord;
                                                }
                                              }

                                              // Single state + DB update for all variants
                                              if (onUpdateTaggedItems)
                                                onUpdateTaggedItems(
                                                  batchedItems
                                                );
                                              if (onSyncTaggedItems)
                                                onSyncTaggedItems(batchedItems);

                                              // Track all new words in sessionVariants
                                              if (
                                                Object.keys(newVariantWords)
                                                  .length > 0
                                              ) {
                                                setSessionVariants((prev) => ({
                                                  ...prev,
                                                  ...newVariantWords,
                                                }));
                                              }
                                            }

                                            // Default unreviewed instances to primary char
                                            if (propSearchResults) {
                                              Object.entries(
                                                propSearchResults.instancesByScene
                                              )
                                                .filter(
                                                  ([key]) =>
                                                    !key.startsWith("_group_")
                                                )
                                                .flatMap(([, ids]) => ids)
                                                .filter(
                                                  (id) =>
                                                    id &&
                                                    id !== instanceId &&
                                                    !instanceStatuses[id] &&
                                                    !instanceCharacters[id]
                                                )
                                                .forEach((id) => {
                                                  updatedChars[id] =
                                                    effectivePrimary;
                                                });
                                            }
                                            setInstanceCharacters(updatedChars);
                                          }

                                          const newStatuses = {
                                            ...instanceStatuses,
                                            [instanceId]: "confirmed",
                                          };
                                          setInstanceStatuses(newStatuses);
                                          const sceneNum = scene.sceneNumber;
                                          setPendingPropScenes((prev) =>
                                            prev.includes(sceneNum)
                                              ? prev
                                              : [...prev, sceneNum]
                                          );
                                          setInstancePopup(null);
                                          advanceToNextInstance(
                                            propViewerSceneIdx,
                                            propViewerInstanceIdx,
                                            newStatuses
                                          );
                                        }}
                                        style={{
                                          flex: 1,
                                          backgroundColor: propColor,
                                          color: "white",
                                          border: "none",
                                          borderRadius: "4px",
                                          padding: "6px",
                                          cursor: "pointer",
                                          fontWeight: "bold",
                                          fontSize: "12px",
                                        }}
                                      >
                                        ✓ Confirm
                                      </button>
                                      <button
                                        onClick={() => {
                                          const newStatuses = {
                                            ...instanceStatuses,
                                            [instanceId]: "rejected",
                                          };
                                          setInstanceStatuses(newStatuses);
                                          setInstancePopup(null);
                                          advanceToNextInstance(
                                            propViewerSceneIdx,
                                            propViewerInstanceIdx,
                                            newStatuses
                                          );
                                        }}
                                        style={{
                                          flex: 1,
                                          backgroundColor: "#f44336",
                                          color: "white",
                                          border: "none",
                                          borderRadius: "4px",
                                          padding: "6px",
                                          cursor: "pointer",
                                          fontWeight: "bold",
                                          fontSize: "12px",
                                        }}
                                      >
                                        ✗ Reject
                                      </button>
                                    </div>

                                    {/* Assign character */}
                                    <div>
                                      {/* Multi-select toggle */}
                                      <label
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "5px",
                                          fontSize: "10px",
                                          color: "#555",
                                          marginBottom: "5px",
                                          cursor: "pointer",
                                          userSelect: "none",
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={instancePopupMultiSelect}
                                          onChange={(e) => {
                                            setInstancePopupMultiSelect(
                                              e.target.checked
                                            );
                                            setInstancePopupMultiChars([]);
                                          }}
                                          style={{ cursor: "pointer" }}
                                        />
                                        Multiple characters
                                      </label>

                                      {!instancePopupMultiSelect ? (
                                        /* Single-select: original dropdown, auto-confirms on pick */
                                        <>
                                          <div
                                            style={{
                                              fontSize: "10px",
                                              color: "#888",
                                              marginBottom: "3px",
                                            }}
                                          >
                                            Assign character:
                                          </div>
                                          <div style={{ position: "relative" }}>
                                            {/* Trigger button */}
                                            <div
                                              ref={charDropdownTriggerRef}
                                              onClick={() => {
                                                const rect = charDropdownTriggerRef.current?.getBoundingClientRect();
                                                if (rect) {
                                                  const approxHeight =
                                                    Object.keys(characters || {}).length * 26 + 36;
                                                  setCharDropdownFlipped(
                                                    rect.bottom + approxHeight > window.innerHeight
                                                  );
                                                }
                                                setInstancePopupCharDropdownOpen((prev) => !prev);
                                              }}
                                              style={{
                                                padding: "4px 7px",
                                                fontSize: "11px",
                                                border: "1px solid #ccc",
                                                borderRadius: instancePopupCharDropdownOpen ? "3px 3px 0 0" : "3px",
                                                backgroundColor: "white",
                                                cursor: "pointer",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                color: instancePopupCharInput ? "#333" : "#aaa",
                                                fontStyle: instancePopupCharInput ? "normal" : "italic",
                                              }}
                                            >
                                              <span>
                                                {instancePopupCharInput || "Select character…"}
                                              </span>
                                              <span style={{ fontSize: "9px", opacity: 0.5 }}>
                                                {instancePopupCharDropdownOpen ? "▲" : "▼"}
                                              </span>
                                            </div>

                                            {/* Dropdown list — only when open */}
                                            {instancePopupCharDropdownOpen && (
                                              <div
                                              style={{
                                                position: "absolute",
                                                ...(charDropdownFlipped
                                                  ? {
                                                      bottom: "100%",
                                                      top: "auto",
                                                      borderRadius: "3px 3px 0 0",
                                                      borderBottom: "none",
                                                      borderTop: "1px solid #90caf9",
                                                      boxShadow: "0 -4px 12px rgba(0,0,0,0.15)",
                                                    }
                                                  : {
                                                      top: "100%",
                                                      bottom: "auto",
                                                      borderRadius: "0 0 3px 3px",
                                                      borderTop: "none",
                                                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                                    }),
                                                left: 0,
                                                width: "100%",
                                                backgroundColor: "white",
                                                border: "1px solid #90caf9",
                                                zIndex: 1300,
                                              }}
                                            >
                                            {/* "None" option */}
                                            <div
                                              onClick={() => {
                                                setInstancePopupCharInput("");
                                                setInstancePopupCharDropdownOpen(false);
                                              }}
                                              style={{
                                                padding: "4px 7px",
                                                fontSize: "11px",
                                                cursor: "pointer",
                                                color: "#aaa",
                                                fontStyle: "italic",
                                                backgroundColor:
                                                  instancePopupCharInput === ""
                                                    ? "#e3f2fd"
                                                    : "transparent",
                                                borderBottom: "1px solid #eee",
                                              }}
                                            >
                                              Select character…
                                            </div>
                                            {Object.keys(characters || {})
                                              .sort()
                                              .map((c) => {
                                                const isSelected =
                                                  instancePopupCharInput === c;
                                                return (
                                                  <div
                                                    key={c}
                                                    onClick={() => {
                                                      const selectedChar = c;
                                                      setInstancePopupCharInput(
                                                        selectedChar
                                                      );

                                                      const existingChar =
                                                        primarySessionChar;
                                                      setLastChosenChar(
                                                        selectedChar
                                                      );

                                                      if (!primarySessionChar) {
                                                        setPrimarySessionChar(
                                                          selectedChar
                                                        );
                                                      } else if (
                                                        existingChar !==
                                                        selectedChar
                                                      ) {
                                                        if (
                                                          sessionVariants[
                                                            selectedChar
                                                          ]
                                                        ) {
                                                          const variantWord =
                                                            sessionVariants[
                                                              selectedChar
                                                            ];
                                                          if (onAddPropToScene) {
                                                            const sceneIdx =
                                                              scenes.findIndex(
                                                                (s) =>
                                                                  String(
                                                                    s.sceneNumber
                                                                  ) ===
                                                                  String(
                                                                    scene.sceneNumber
                                                                  )
                                                              );
                                                            if (sceneIdx >= 0)
                                                              onAddPropToScene(
                                                                variantWord,
                                                                sceneIdx
                                                              );
                                                          }
                                                        } else {
                                                          if (onCreateNewProp) {
                                                            const createdWord =
                                                              onCreateNewProp(
                                                                selectedProp.customTitle ||
                                                                  "Prop",
                                                                null,
                                                                [
                                                                  scene.sceneNumber,
                                                                ],
                                                                {
                                                                  variant:
                                                                    selectedChar,
                                                                }
                                                              );
                                                            if (createdWord) {
                                                              setSessionVariants(
                                                                (prev) => ({
                                                                  ...prev,
                                                                  [selectedChar]:
                                                                    createdWord,
                                                                })
                                                              );
                                                            }
                                                          }
                                                        }
                                                        setInstanceVariants(
                                                          (prev) => ({
                                                            ...prev,
                                                            [instanceId]:
                                                              selectedChar,
                                                          })
                                                        );
                                                      }

                                                      setPendingPropScenes(
                                                        (prev) => {
                                                          const sceneNum =
                                                            scene.sceneNumber;
                                                          return prev.includes(
                                                            sceneNum
                                                          )
                                                            ? prev
                                                            : [
                                                                ...prev,
                                                                sceneNum,
                                                              ];
                                                        }
                                                      );

                                                      const updatedChars = {
                                                        ...instanceCharacters,
                                                        [instanceId]:
                                                          selectedChar,
                                                      };
                                                      if (propSearchResults) {
                                                        Object.entries(
                                                          propSearchResults.instancesByScene
                                                        )
                                                          .filter(
                                                            ([key]) =>
                                                              !key.startsWith(
                                                                "_group_"
                                                              )
                                                          )
                                                          .flatMap(
                                                            ([, ids]) => ids
                                                          )
                                                          .filter(
                                                            (id) =>
                                                              id &&
                                                              id !==
                                                                instanceId &&
                                                              !instanceStatuses[
                                                                id
                                                              ] &&
                                                              !instanceCharacters[
                                                                id
                                                              ]
                                                          )
                                                          .forEach((id) => {
                                                            updatedChars[id] =
                                                              primarySessionChar ||
                                                              selectedChar;
                                                          });
                                                      }
                                                      setInstanceCharacters(
                                                        updatedChars
                                                      );

                                                      const newStatuses = {
                                                        ...instanceStatuses,
                                                        [instanceId]:
                                                          "confirmed",
                                                      };
                                                      setInstanceStatuses(
                                                        newStatuses
                                                      );
                                                      setInstancePopup(null);
                                                      advanceToNextInstance(
                                                        propViewerSceneIdx,
                                                        propViewerInstanceIdx,
                                                        newStatuses
                                                      );
                                                    }}
                                                    style={{
                                                      padding: "4px 7px",
                                                      fontSize: "11px",
                                                      cursor: "pointer",
                                                      backgroundColor: isSelected
                                                        ? "#e3f2fd"
                                                        : "transparent",
                                                      fontWeight: isSelected
                                                        ? "bold"
                                                        : "normal",
                                                      color: isSelected
                                                        ? "#1565c0"
                                                        : "#333",
                                                    }}
                                                  >
                                                    {c}
                                                  </div>
                                                );
                                              })}
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      ) : (
                                        /* Multi-select: checklist, confirmed via Confirm button */
                                        <div
                                          style={{
                                            border: "1px solid #90caf9",
                                            borderRadius: "4px",
                                            padding: "5px 7px",
                                            backgroundColor: "#f0f7ff",
                                          }}
                                        >
                                          {Object.keys(characters || {})
                                            .sort()
                                            .map((c) => (
                                              <label
                                                key={c}
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: "5px",
                                                  fontSize: "11px",
                                                  padding: "2px 0",
                                                  cursor: "pointer",
                                                  fontWeight:
                                                    instancePopupMultiChars[0] ===
                                                    c
                                                      ? "bold"
                                                      : "normal",
                                                  color:
                                                    instancePopupMultiChars[0] ===
                                                    c
                                                      ? "#1565c0"
                                                      : "#333",
                                                }}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={instancePopupMultiChars.includes(
                                                    c
                                                  )}
                                                  onChange={(e) => {
                                                    setInstancePopupMultiChars(
                                                      (prev) =>
                                                        e.target.checked
                                                          ? [...prev, c]
                                                          : prev.filter(
                                                              (x) => x !== c
                                                            )
                                                    );
                                                  }}
                                                  style={{ cursor: "pointer" }}
                                                />
                                                {c}
                                                {instancePopupMultiChars[0] ===
                                                  c && (
                                                  <span
                                                    style={{
                                                      fontSize: "9px",
                                                      color: "#1976d2",
                                                      marginLeft: "2px",
                                                    }}
                                                  >
                                                    (primary)
                                                  </span>
                                                )}
                                              </label>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  </span>
                                )}
                            </span>
                          );
                        })}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

      {/* Script Popup Modal with exact Script module styling */}
      {selectedProp &&
        showScenePreview &&
        (selectedProp.contextScene !== null ||
          (selectedProp.contextScene === null &&
            selectedProp.viewingSceneNumber)) && (
          <>
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(0,0,0,0.7)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => setShowScenePreview(false)}
            >
              <div
                style={{
                  backgroundColor: "white",
                  width: "90%",
                  maxWidth: "9.28in",
                  height: "85%",
                  borderRadius: "8px",
                  overflow: "hidden",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  // Define scene at the top so it's available to header and content
                  let scene;
                  let sceneIndex;
                  if (selectedProp.contextScene !== null) {
                    sceneIndex = selectedProp.contextScene;
                    scene = scenes[sceneIndex];
                  } else {
                    const viewingSceneNumber =
                      selectedProp.viewingSceneNumber || selectedProp.scenes[0];
                    sceneIndex = scenes.findIndex(
                      (s) => s.sceneNumber === String(viewingSceneNumber)
                    );
                    scene = scenes[sceneIndex];
                  }

                  if (!scene) {
                    return (
                      <div style={{ padding: "20px" }}>Scene not found</div>
                    );
                  }

                  return (
                    <>
                      {/* Header */}
                      <div
                        style={{
                          backgroundColor: "#2196F3",
                          color: "white",
                          padding: "15px 20px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            margin: 0,
                            fontSize: "12pt",
                            fontFamily: "Courier New, monospace",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {scene.sceneNumber}. {scene.heading}
                        </div>

                        {/* Navigation controls for left panel context */}
                        {selectedProp.contextScene === null &&
                          selectedProp.scenes &&
                          selectedProp.scenes.length > 1 && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <button
                                onClick={() => {
                                  const currentIndex =
                                    selectedProp.scenes.indexOf(
                                      selectedProp.viewingSceneNumber ||
                                        selectedProp.scenes[0]
                                    );
                                  const prevIndex =
                                    currentIndex > 0
                                      ? currentIndex - 1
                                      : selectedProp.scenes.length - 1;
                                  setSelectedProp((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedProp.scenes[prevIndex],
                                  }));
                                }}
                                style={{
                                  backgroundColor: "rgba(255,255,255,0.2)",
                                  color: "white",
                                  border: "1px solid rgba(255,255,255,0.3)",
                                  borderRadius: "4px",
                                  padding: "6px 12px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                ← Prev
                              </button>
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "rgba(255,255,255,0.8)",
                                }}
                              >
                                {(() => {
                                  const currentIndex =
                                    selectedProp.scenes.indexOf(
                                      selectedProp.viewingSceneNumber ||
                                        selectedProp.scenes[0]
                                    );
                                  return `${currentIndex + 1} of ${
                                    selectedProp.scenes.length
                                  }`;
                                })()}
                              </span>
                              <button
                                onClick={() => {
                                  const currentIndex =
                                    selectedProp.scenes.indexOf(
                                      selectedProp.viewingSceneNumber ||
                                        selectedProp.scenes[0]
                                    );
                                  const nextIndex =
                                    currentIndex <
                                    selectedProp.scenes.length - 1
                                      ? currentIndex + 1
                                      : 0;
                                  setSelectedProp((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedProp.scenes[nextIndex],
                                  }));
                                }}
                                style={{
                                  backgroundColor: "rgba(255,255,255,0.2)",
                                  color: "white",
                                  border: "1px solid rgba(255,255,255,0.3)",
                                  borderRadius: "4px",
                                  padding: "6px 12px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Next →
                              </button>
                            </div>
                          )}

                        <button
                          onClick={() => setShowScenePreview(false)}
                          style={{
                            backgroundColor: "transparent",
                            border: "none",
                            color: "white",
                            fontSize: "24px",
                            cursor: "pointer",
                            padding: "0 5px",
                          }}
                        >
                          ×
                        </button>
                      </div>

                      {/* Script Content with exact Script module styling */}
                      <div
                        style={{
                          flex: 1,
                          padding: "1.5in",
                          overflow: "auto",
                          backgroundColor: "white",
                          boxSizing: "border-box",
                          textAlign: "left",
                          fontFamily: "Courier New, monospace",
                        }}
                      >
                        {/* Scene Heading */}
                        <div style={getElementStyle("Scene Heading")}>
                          {scene.heading}
                        </div>

                        {/* Scene Content */}
                        <div style={{ lineHeight: "1.6", fontSize: "14px" }}>
                          {scene.content.map((block, blockIndex) => {
                            const renderContent = () => {
                              const words = block.text.split(/(\s+)/);
                              const sceneInstances = propSearchResults
                                ? propSearchResults.instancesByScene[
                                    sceneIndex
                                  ] || []
                                : [];
                              return words.map((word, wordIndex) => {
                                if (!word.trim()) return word;

                                const cleanWord = word
                                  .toLowerCase()
                                  .replace(/[^\w]/g, "");
                                const stemmedWord = stemWord(cleanWord);

                                const instanceId = `${sceneIndex}-${blockIndex}-${wordIndex}`;
                                const primaryForThis = sceneInstances.find(
                                  (id) =>
                                    (
                                      propSearchResults?.instancesByScene[
                                        `_group_${id}`
                                      ] || [id]
                                    ).includes(instanceId)
                                );
                                const isInResults =
                                  !!primaryForThis ||
                                  sceneInstances.includes(instanceId);

                                // In scene preview, highlight if the instance is in results
                                // AND the scene is saved in this prop's scenes array
                                const sceneNum = scene?.sceneNumber;
                                const sceneIsSaved = (selectedProp.scenes || [])
                                  .map(String)
                                  .includes(String(sceneNum));
                                const isCurrentProp =
                                  isInResults && sceneIsSaved;

                                const isTagged =
                                  !isCurrentProp &&
                                  Object.keys(taggedItems).some(
                                    (taggedWord) => stemmedWord === taggedWord
                                  );

                                if (isCurrentProp) {
                                  return (
                                    <span
                                      key={wordIndex}
                                      style={{
                                        backgroundColor: selectedProp.color,
                                        color: "white",
                                        padding: "2px 4px",
                                        borderRadius: "3px",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {word}
                                    </span>
                                  );
                                } else if (isTagged) {
                                  const taggedItem = Object.entries(
                                    taggedItems
                                  ).find(([key]) => stemmedWord === key);
                                  return (
                                    <span
                                      key={wordIndex}
                                      style={{
                                        backgroundColor:
                                          taggedItem?.[1]?.color || "#ccc",
                                        color: "white",
                                        padding: "1px 2px",
                                        borderRadius: "2px",
                                        opacity: 0.7,
                                      }}
                                    >
                                      {word}
                                    </span>
                                  );
                                }

                                return word;
                              });
                            };

                            return (
                              <div
                                key={blockIndex}
                                style={getElementStyle(block.type)}
                              >
                                {renderContent()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        )}

      {/* Lightbox — fullscreen image viewer */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.88)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <img
            src={lightboxImage}
            alt="Prop photo fullsize"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: "6px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          />
          <button
            onClick={() => setLightboxImage(null)}
            style={{
              position: "absolute",
              top: "20px",
              right: "24px",
              backgroundColor: "transparent",
              border: "none",
              color: "white",
              fontSize: "36px",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default PropsModule;