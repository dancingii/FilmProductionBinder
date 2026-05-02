import React from "react";
import { getElementStyle, calculateBlockLines, LINES_PER_PAGE } from "../../../utils.js";
import { PDFExporter } from "../../../utils/pdfExport";
import * as database from "../../../services/database";

function CallSheetModule({
  scenes: callSheetScenes,
  shootingDays,
  castCrew,
  onUpdateCastCrew,
  characters,
  stripboardScenes,
  scheduledScenes,
  projectSettings,
  setProjectSettings,
  callSheetData,
  setCallSheetData,
  updateCrewCallTime,
  wardrobeItems,
  scriptLocations,
  actualLocations,
  getFinalCharacterScenes,
  syncCallSheetData,
  selectedProject,
  taggedItems,
  initialDayNumber,
}) {
  const exportCallSheetPDF = async () => {
    if (!selectedDay) return;

    if (!window.pdfMake) {
      alert("PDF library not available. Please refresh the page.");
      return;
    }

    try {
      const scenes = getScheduledScenes();

      const locationGroups = [];
      let currentGroup = null;
      let sceneRowIndex = 0;

      scenes.forEach((scene, index) => {
        if (scene.scene === "LUNCH") {
          if (currentGroup) {
            currentGroup.rowSpan++;
          }
          sceneRowIndex++;
          return;
        }

        let physicalAddress = scene.location || "";
        const matchingScriptLocation = scriptLocations.find(
          (scriptLoc) =>
            scriptLoc.scenes &&
            (scriptLoc.scenes.includes(parseInt(scene.scene)) ||
              scriptLoc.scenes.includes(scene.scene.toString()))
        );

        if (matchingScriptLocation && matchingScriptLocation.actualLocationId) {
          const actualLocation = actualLocations.find(
            (actual) => actual.id === matchingScriptLocation.actualLocationId
          );
          if (actualLocation && actualLocation.address) {
            const addressParts = [
              actualLocation.address,
              actualLocation.city,
              actualLocation.state,
              actualLocation.zipCode,
            ].filter(Boolean);
            physicalAddress = addressParts.join(", ");
          }
        }

        const normalized = physicalAddress.toLowerCase().trim();

        if (!currentGroup || currentGroup.location !== normalized) {
          if (currentGroup) {
            locationGroups.push(currentGroup);
          }
          currentGroup = {
            location: normalized,
            address: physicalAddress,
            startRow: sceneRowIndex,
            rowSpan: 1,
          };
        } else {
          currentGroup.rowSpan++;
        }

        sceneRowIndex++;
      });

      if (currentGroup) {
        locationGroups.push(currentGroup);
      }

      const scenesTableBody = [];
      sceneRowIndex = 0;

      scenes.forEach((scene) => {
        if (scene.scene === "LUNCH") {
          const lunchRow = [
            { text: scene.time, fontSize: 6, alignment: "center", fillColor: "#90EE90" },
            { text: "LUNCH", colSpan: 9, fontSize: 6, bold: true, alignment: "center", fillColor: "#90EE90" },
            {}, {}, {}, {}, {}, {}, {}, {},
          ];

          const isInRowSpan = locationGroups.some(
            (g) => sceneRowIndex > g.startRow && sceneRowIndex < g.startRow + g.rowSpan
          );

          if (!isInRowSpan) {
            lunchRow.push({ text: "", fontSize: 6, fillColor: "#90EE90" });
          }

          scenesTableBody.push(lunchRow);
          sceneRowIndex++;
        } else {
          const stripboardScene = stripboardScenes.find(
            (s) => s.sceneNumber == scene.scene
          );
          const pageNum = stripboardScene?.pageNumber || "1";
          const mainScene = callSheetScenes.find(
            (s) => s.sceneNumber == scene.scene
          );
          const pageLength = mainScene?.pageLength || scene.pages || "1/8";

          const locationGroup = locationGroups.find(
            (g) => g.startRow === sceneRowIndex
          );
          const isInRowSpan =
            !locationGroup &&
            locationGroups.some(
              (g) =>
                sceneRowIndex > g.startRow &&
                sceneRowIndex < g.startRow + g.rowSpan
            );

          const row = [
            { text: scene.time, fontSize: 6, alignment: "center" },
            { text: scene.scene.toString(), fontSize: 6, alignment: "center" },
            { text: scene.ie, fontSize: 6, alignment: "center" },
            { text: scene.location, fontSize: 6 },
            { text: scene.cast, fontSize: 6 },
            { text: scene.dn, fontSize: 6, alignment: "center" },
            { text: pageNum.toString(), fontSize: 6, alignment: "center" },
            { text: pageLength, fontSize: 6, alignment: "center" },
            { text: scene.wardrobe || "", fontSize: 6 },
            { text: scene.props || "", fontSize: 6 },
          ];

          if (locationGroup) {
            row.push({
              text: locationGroup.address,
              fontSize: 6,
              alignment: "center",
              rowSpan: locationGroup.rowSpan,
              valign: "middle",
            });
          } else if (!isInRowSpan) {
            row.push({ text: "", fontSize: 6 });
          }

          scenesTableBody.push(row);
          sceneRowIndex++;
        }
      });

      scenesTableBody.push([
        { text: "TOTAL PAGES", colSpan: 7, bold: true, alignment: "center", fontSize: 8 },
        {}, {}, {}, {}, {}, {},
        { text: totalPages, bold: true, fontSize: 8 },
        {}, {}, {},
      ]);

      const castTableBody = daycast.map((cast) => [
        { text: cast.number.toString(), alignment: "center", fontSize: 7 },
        { text: cast.cast, fontSize: 7 },
        { text: cast.character, fontSize: 7 },
        { text: cast.makeup || "", alignment: "center", fontSize: 7 },
        { text: cast.set || "", alignment: "center", fontSize: 7 },
        { text: cast.specialInstructions || "", fontSize: 7 },
      ]);

      const { leftTable, rightTable } = distributeCrewToTables();

      const buildCrewTable = (table) => {
        const rows = [];
        table.forEach((item) => {
          if (item.type === "header") {
            rows.push([
              { text: item.department.toUpperCase(), colSpan: 4, bold: true, alignment: "center", fillColor: "#f0f0f0", fontSize: 7 },
              {}, {}, {},
            ]);
          } else {
            rows.push([
              { text: item.position, fontSize: 7 },
              { text: item.displayName, fontSize: 7 },
              { text: item.phone, fontSize: 7, alignment: "center" },
              { text: callSheetData.crewCallTimes?.[item.id] || "", fontSize: 7, alignment: "center" },
            ]);
          }
        });
        return rows;
      };

      const leftCrewBody = buildCrewTable(leftTable);
      const rightCrewBody = buildCrewTable(rightTable);

      const date = new Date(selectedDay.date + "T00:00:00");
      const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;

      const docDefinition = {
        pageSize: "LETTER",
        pageMargins: [25, 25, 25, 25],
        content: [
          {
            table: {
              widths: [177, 178, 177],
              body: [
                [
                  {
                    stack: [
                      { text: [{ text: "Producer: ", bold: true }, { text: projectSettings.producer || "TBD" }], fontSize: 8, margin: [0, 1, 0, 1] },
                      { text: [{ text: "Director: ", bold: true }, { text: projectSettings.director || "TBD" }], fontSize: 8, margin: [0, 1, 0, 1] },
                      { text: [{ text: "Hospital: ", bold: true }, { text: projectSettings.nearestHospital?.name || "TBD" }], fontSize: 8, margin: [0, 1, 0, 1] },
                      { text: [{ text: "Phone: ", bold: true }, { text: projectSettings.nearestHospital?.phone || "" }], fontSize: 8, margin: [0, 1, 0, 1] },
                      { text: projectSettings.nearestHospital?.address || "", fontSize: 7, margin: [0, 1, 0, 0] },
                    ],
                    margin: [3, 3, 3, 3],
                  },
                  { text: projectSettings.filmTitle || "FILM TITLE", fontSize: 16, bold: true, alignment: "center", fillColor: "#cccccc", margin: [0, 18, 0, 0] },
                  {
                    stack: [
                      { columns: [{ text: dateStr, fontSize: 15, bold: true, width: "auto" }, { text: `Day ${selectedDay.dayNumber} of ${shootingDays.length}`, fontSize: 8, alignment: "right", width: "*" }], margin: [0, 3, 0, 0] },
                      { text: "", margin: [0, 2, 0, 0] },
                      { columns: [{ text: "SU", fontSize: 7, width: "auto" }, { text: "SUNSET", fontSize: 7, alignment: "right", width: "*" }] },
                      { columns: [{ text: weather?.sunrise || "6:45 AM", fontSize: 7, width: "auto" }, { text: weather?.sunset || "7:30 PM", fontSize: 7, alignment: "right", width: "*" }] },
                      { columns: [{ text: `WE ${weather?.temp || 72}°`, fontSize: 7, width: "auto" }, { text: `HI ${weather?.temp + 5 || 77}°`, fontSize: 7, alignment: "right", width: "*" }] },
                      { columns: [{ text: "HU 10%", fontSize: 7, width: "auto" }, { text: weather?.condition || "Clear", fontSize: 7, alignment: "right", width: "*" }] },
                    ],
                    margin: [3, 3, 3, 3],
                  },
                ],
              ],
            },
            layout: { hLineWidth: () => 1.5, vLineWidth: () => 1 },
            margin: [0, 0, 0, 5],
          },
          {
            columns: [
              { table: { widths: ["*"], body: [[{ stack: [{ text: "NOTES:", bold: true, fontSize: 8, margin: [0, 0, 0, 2] }, { text: currentDayNotes || "", fontSize: 9 }], margin: [3, 3, 3, 3] }]] }, layout: "noBorders", width: 195 },
              { table: { widths: [65, 107], body: [[{ text: "CALL", fontSize: 14, bold: true, alignment: "center", margin: [0, 15, 0, 15] }, { text: callTime, fontSize: 14, bold: true, alignment: "center", margin: [0, 15, 0, 15] }]] }, layout: { hLineWidth: () => 1.5, vLineWidth: () => 1.5 }, width: 172 },
              { text: "", width: 195 },
            ],
            margin: [0, 0, 0, 5],
          },
          {
            table: {
              headerRows: 1,
              widths: [30, 16, 16, 46, 100, 18, 16, 20, 40, 40, 126],
              body: [
                [
                  { text: "TIME", fontSize: 6, bold: true, alignment: "center", fillColor: "#f0f0f0" },
                  { text: "SC", fontSize: 6, bold: true, alignment: "center", fillColor: "#f0f0f0" },
                  { text: "I/E", fontSize: 6, bold: true, alignment: "center", fillColor: "#f0f0f0" },
                  { text: "LOCATION/DESC", fontSize: 6, bold: true, alignment: "center", fillColor: "#f0f0f0" },
                  { text: "CAST", fontSize: 6, bold: true, alignment: "center", fillColor: "#f0f0f0" },
                  { text: "D/N", fontSize: 6, bold: true, alignment: "center", fillColor: "#f0f0f0" },
                  { text: "PG#", fontSize: 6, bold: true, alignment: "center", fillColor: "#f0f0f0" },
                  { text: "PGS", fontSize: 6, bold: true, alignment: "center", fillColor: "#f0f0f0" },
                  { text: "WARDROBE", fontSize: 6, bold: true, alignment: "center", fillColor: "#f0f0f0" },
                  { text: "PROPS", fontSize: 6, bold: true, alignment: "center", fillColor: "#f0f0f0" },
                  { text: "LOCATION", fontSize: 6, bold: true, alignment: "center", fillColor: "#f0f0f0" },
                ],
                ...scenesTableBody,
              ],
            },
            layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, paddingTop: () => 1, paddingBottom: () => 1 },
            margin: [0, 0, 0, 5],
          },
          {
            table: {
              headerRows: 1,
              widths: [25, 95, 95, 48, 48, 200],
              body: [
                [
                  { text: "#", alignment: "center", fillColor: "#f0f0f0", fontSize: 7 },
                  { text: "CAST", fillColor: "#f0f0f0", fontSize: 7 },
                  { text: "CHARACTER", fillColor: "#f0f0f0", fontSize: 7 },
                  { text: "MU", alignment: "center", fillColor: "#f0f0f0", fontSize: 7 },
                  { text: "SET", alignment: "center", fillColor: "#f0f0f0", fontSize: 7 },
                  { text: "SPECIAL INSTRUCTIONS", fillColor: "#f0f0f0", fontSize: 7 },
                ],
                ...castTableBody,
              ],
            },
            layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, paddingTop: () => 2, paddingBottom: () => 2 },
            margin: [0, 0, 0, 5],
          },
          {
            table: { widths: ["*"], body: [[{ text: "PRODUCTION NOTES", bold: true, fontSize: 9, alignment: "center", fillColor: "#f0f0f0" }]] },
            layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
            margin: [0, 0, 0, 0],
          },
          {
            columns: [
              {
                table: { widths: ["*"], body: [[{ stack: productionNotes.slice(0, 2).map((note) => ({ text: [{ text: `${note}: `, bold: true }, { text: customNotes[note] || "" }], fontSize: 8, margin: [0, 1, 0, 1] })), margin: [3, 3, 3, 3] }]] },
                layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
                width: "50%",
              },
              {
                table: { widths: ["*"], body: [[{ stack: productionNotes.slice(2).map((note) => ({ text: [{ text: `${note}: `, bold: true }, { text: customNotes[note] || "" }], fontSize: 8, margin: [0, 1, 0, 1] })), margin: [3, 3, 3, 3] }]] },
                layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
                width: "50%",
              },
            ],
            margin: [0, 0, 0, 5],
          },
          {
            columns: [
              {
                table: {
                  headerRows: 1,
                  widths: [55, 75, 55, 52],
                  body: leftCrewBody.length > 0
                    ? [
                        [{ text: "POSITION", fillColor: "#f0f0f0", fontSize: 7 }, { text: "NAME", fillColor: "#f0f0f0", fontSize: 7 }, { text: "PHONE", fillColor: "#f0f0f0", fontSize: 7 }, { text: "IN", fillColor: "#f0f0f0", fontSize: 7 }],
                        ...leftCrewBody,
                      ]
                    : [[{ text: "", colSpan: 4 }, {}, {}, {}]],
                },
                layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, paddingTop: () => 1, paddingBottom: () => 1 },
                width: 275,
              },
              {
                table: {
                  headerRows: 1,
                  widths: [55, 75, 55, 52],
                  body: rightCrewBody.length > 0
                    ? [
                        [{ text: "POSITION", fillColor: "#f0f0f0", fontSize: 7 }, { text: "NAME", fillColor: "#f0f0f0", fontSize: 7 }, { text: "PHONE", fillColor: "#f0f0f0", fontSize: 7 }, { text: "IN", fillColor: "#f0f0f0", fontSize: 7 }],
                        ...rightCrewBody,
                      ]
                    : [[{ text: "", colSpan: 4 }, {}, {}, {}]],
                },
                layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, paddingTop: () => 1, paddingBottom: () => 1 },
                width: 275,
              },
            ],
            columnGap: 15,
          },
        ],
      };

      const filename = `call-sheet-${selectedDay.date}.pdf`;
      PDFExporter.download(docDefinition, filename);
      alert(`Call sheet exported as: ${filename}`);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export PDF. Error: " + error.message);
    }
  };

  const exportSidesPDF = () => {
    if (!selectedDay) return;
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF?.jsPDF || window.jsPDF;
    if (!jsPDF) { alert("PDF export library not available."); return; }

    const daySceneList = getScheduledScenes()
      .filter(s => s.scene !== "LUNCH" && s.scene !== "ADR")
      .map(s => callSheetScenes.find(sc => sc.sceneNumber == s.scene))
      .filter(Boolean)
      .filter(scene => {
        const h = scene.heading?.toUpperCase() || "";
        if (!h.includes("INT.") && !h.includes("EXT."))
          return !scene.content?.some(b => b.text?.toLowerCase().includes("written by"));
        return true;
      });

    if (daySceneList.length === 0) { alert("No scenes scheduled for this day."); return; }

    const targetNums = new Set(daySceneList.map(s => String(s.sceneNumber)));
    const doc = new jsPDF("portrait", "pt", "letter");
    const PW = 612, LM = 108, RM = 540, TOP = 48, LH = 12, BOTTOM = 756, SLPP = LINES_PER_PAGE;
    const COLS = {
      "Scene Heading": { x: LM,       w: RM - LM },
      "Action":        { x: LM,       w: RM - LM },
      "Character":     { x: LM + 144, w: 216 },
      "Dialogue":      { x: LM + 72,  w: 252 },
      "Parenthetical": { x: LM + 108, w: 216 },
      "Transition":    { x: LM + 144, w: RM - LM - 144 },
    };

    // Build flat content list with exact cumulative line positions
    const sorted = [...callSheetScenes]
      .filter(s => s.content)
      .sort((a, b) => parseFloat(a.sceneNumber) - parseFloat(b.sceneNumber));

    let cumLine = 0;
    const flat = [];
    sorted.forEach(scene => {
      flat.push({ sceneNum: scene.sceneNumber, type: "Scene Heading", text: scene.heading?.toUpperCase() || "", startLine: cumLine, lineCount: 2, isHeading: true });
      cumLine += 2;
      (scene.content || []).forEach(block => {
        const lc = calculateBlockLines(block);
        flat.push({ sceneNum: scene.sceneNumber, type: block.type, text: block.type === "Character" ? (block.text || "").toUpperCase() : (block.text || ""), startLine: cumLine, lineCount: lc });
        cumLine += lc;
      });
      cumLine += 0.5;
    });

    // Find script pages that contain target scenes
    const targetPages = new Set();
    flat.forEach(item => {
      if (!targetNums.has(String(item.sceneNum))) return;
      const sp = Math.floor(item.startLine / SLPP);
      const ep = Math.floor((item.startLine + item.lineCount - 0.01) / SLPP);
      for (let p = sp; p <= ep; p++) targetPages.add(p);
    });

    const pages = Array.from(targetPages).sort((a, b) => a - b);
    if (pages.length === 0) { alert("No content found."); return; }

    let firstPDFPage = true;
    pages.forEach((scriptPage, pIdx) => {
      if (!firstPDFPage) doc.addPage();
      firstPDFPage = false;
      const lineStart = scriptPage * SLPP;
      const lineEnd = lineStart + SLPP;

      doc.setFont("Courier", "normal");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`${scriptPage + 1}.`, PW - 50, TOP - 15);

      if (pIdx === 0) {
        doc.setFont("Courier", "bold");
        doc.setFontSize(11);
        doc.text(`Shoot Day ${selectedDay.dayNumber} - ${formatDate(selectedDay.date)}`, PW / 2, TOP - 28, { align: "center" });
      }

      const items = flat.filter(item => item.startLine < lineEnd && item.startLine + item.lineCount > lineStart);

      let yPos = TOP;
      items.forEach(item => {
        const isTarget = targetNums.has(String(item.sceneNum));
        const c = COLS[item.type] || COLS["Action"];
        const isBold = item.type === "Scene Heading";
        doc.setFontSize(12);
        doc.setFont("Courier", isBold ? "bold" : "normal");
        const lines = doc.splitTextToSize(item.text, c.w);

        if (item.isHeading && yPos > TOP) yPos += LH;

        const baseY = yPos;
        if (baseY > BOTTOM) return;

        if (!isTarget) {
          doc.setTextColor(150, 150, 150);
          doc.setDrawColor(150, 150, 150);
          doc.setLineWidth(0.5);
          lines.forEach((line, li) => {
            const y = baseY + li * LH;
            if (y > BOTTOM) return;
            doc.text(line, c.x, y);
            doc.line(c.x, y - 4, c.x + doc.getTextWidth(line), y - 4);
          });
          if (item.isHeading) {
            doc.text(String(item.sceneNum), LM - 30, baseY);
            doc.text(String(item.sceneNum), RM + 5, baseY);
          }
        } else {
          doc.setTextColor(0, 0, 0);
          lines.forEach((line, li) => {
            const y = baseY + li * LH;
            if (y > BOTTOM) return;
            doc.text(line, c.x, y);
          });
          if (item.isHeading) {
            doc.text(String(item.sceneNum), LM - 30, baseY);
            doc.text(String(item.sceneNum), RM + 5, baseY);
          }
        }

        yPos += lines.length * LH + LH;
      });
      doc.setTextColor(0, 0, 0);
      doc.setFont("Courier", "normal");
    });

    const dateStr = new Date(selectedDay.date).toISOString().split("T")[0];
    doc.save(`sides-day-${selectedDay.dayNumber}-${dateStr}.pdf`);
    alert(`Sides exported: sides-day-${selectedDay.dayNumber}-${dateStr}.pdf`);
  };

  const getSmartDefaultDay = (shootingDays) => {
    if (!shootingDays || shootingDays.length === 0) return null;

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const todayMatch = shootingDays.find((day) => day.date === todayStr);
    if (todayMatch) return todayMatch;

    const futureDays = shootingDays
      .filter((day) => day.date > todayStr)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (futureDays.length > 0) return futureDays[0];

    const pastDays = shootingDays
      .filter((day) => day.date < todayStr)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return pastDays.length > 0 ? pastDays[0] : shootingDays[0];
  };

  const [selectedDay, setSelectedDay] = React.useState(null);

  // Auto-select day from deep link (e.g. clicking shoot date badge in Props)
  React.useEffect(() => {
    if (!initialDayNumber || !shootingDays?.length) return;
    const match = shootingDays.find(d => d.dayNumber === initialDayNumber);
    if (match) setSelectedDay(match);
  }, [initialDayNumber, shootingDays?.length]);
  const [weather, setWeather] = React.useState(null);
  const [removalModal, setRemovalModal] = React.useState(null);
  const [manualCast, setManualCast] = React.useState([]);
  const [productionNotes, setProductionNotes] = React.useState([
    "Allowed Guests",
    "No. of Stand-ins",
    "Special Props",
    "Special Atmosphere",
  ]);
  const autoPopulatedDays = React.useRef(new Set());

  const LA_AREA_HOSPITALS = {
    hollywood: { name: "Hollywood Presbyterian Medical Center", phone: "(323) 413-3000", address: "1300 N Vermont Ave, Los Angeles, CA 90027" },
    "beverly hills": { name: "Cedars-Sinai Medical Center", phone: "(310) 423-5000", address: "8700 Beverly Blvd, Los Angeles, CA 90048" },
    "west hollywood": { name: "Cedars-Sinai Medical Center", phone: "(310) 423-5000", address: "8700 Beverly Blvd, Los Angeles, CA 90048" },
    "santa monica": { name: "Santa Monica Hospital", phone: "(310) 319-4000", address: "1250 16th St, Santa Monica, CA 90404" },
    venice: { name: "Santa Monica Hospital", phone: "(310) 319-4000", address: "1250 16th St, Santa Monica, CA 90404" },
    "culver city": { name: "Southern California Hospital", phone: "(310) 558-6200", address: "3828 Delmas Terrace, Culver City, CA 90232" },
    downtown: { name: "Good Samaritan Hospital", phone: "(213) 977-2121", address: "1225 Wilshire Blvd, Los Angeles, CA 90017" },
    "los angeles": { name: "Good Samaritan Hospital", phone: "(213) 977-2121", address: "1225 Wilshire Blvd, Los Angeles, CA 90017" },
    pasadena: { name: "Huntington Hospital", phone: "(626) 397-5000", address: "100 W California Blvd, Pasadena, CA 91105" },
    burbank: { name: "Providence Saint Joseph Medical Center", phone: "(818) 843-5111", address: "501 S Buena Vista St, Burbank, CA 91505" },
    glendale: { name: "Glendale Memorial Hospital", phone: "(818) 502-1900", address: "1420 S Central Ave, Glendale, CA 91204" },
    "long beach": { name: "Long Beach Memorial Medical Center", phone: "(562) 933-2000", address: "2801 Atlantic Ave, Long Beach, CA 90806" },
    "orange county": { name: "UC Irvine Medical Center", phone: "(714) 456-6011", address: "101 The City Dr S, Orange, CA 92868" },
    anaheim: { name: "Anaheim Regional Medical Center", phone: "(714) 774-1450", address: "1111 W La Palma Ave, Anaheim, CA 92801" },
    valencia: { name: "Henry Mayo Newhall Hospital", phone: "(661) 253-8000", address: "23845 McBean Pkwy, Valencia, CA 91355" },
    palmdale: { name: "Palmdale Regional Medical Center", phone: "(661) 382-5000", address: "38600 Medical Center Dr, Palmdale, CA 93551" },
    malibu: { name: "Santa Monica Hospital", phone: "(310) 319-4000", address: "1250 16th St, Santa Monica, CA 90404" },
  };

  const currentDayId = selectedDay?.id;
  const currentDayCrewData = callSheetData.crewByDay?.[currentDayId] || { assignedCrew: [] };
  const currentDayTableSizes = callSheetData.tableSizesByDay?.[currentDayId] || { left: 8, right: 8 };

  const assignedCrew = currentDayCrewData.assignedCrew || [];
  const leftTableSize = currentDayTableSizes.left || 8;
  const rightTableSize = currentDayTableSizes.right || 8;

  const currentDayCallTime = callSheetData.callTimeByDay?.[currentDayId] || "7:30 AM";
  const currentDayNotes = callSheetData.notesByDay?.[currentDayId] || "";
  const castCallTimes = callSheetData.castCallTimes;
  const customNotes = callSheetData.customNotes;

  const setAssignedCrew = (newCrew) => {
    if (!currentDayId) return;

    const updatedCrew =
      typeof newCrew === "function"
        ? newCrew(callSheetData.crewByDay?.[currentDayId]?.assignedCrew || [])
        : newCrew;

    const newCallSheetData = {
      ...callSheetData,
      crewByDay: {
        ...callSheetData.crewByDay,
        [currentDayId]: {
          ...callSheetData.crewByDay?.[currentDayId],
          assignedCrew: updatedCrew,
        },
      },
    };

    setCallSheetData(newCallSheetData);
    if (syncCallSheetData) {
      syncCallSheetData(newCallSheetData);
    }
  };

  const setLeftTableSize = (newSize) => {
    if (!currentDayId) return;
    setCallSheetData((prev) => ({
      ...prev,
      tableSizesByDay: {
        ...prev.tableSizesByDay,
        [currentDayId]: {
          ...prev.tableSizesByDay?.[currentDayId],
          left: typeof newSize === "function" ? newSize(prev.tableSizesByDay?.[currentDayId]?.left || 8) : newSize,
        },
      },
    }));
  };

  const setRightTableSize = (newSize) => {
    if (!currentDayId) return;
    setCallSheetData((prev) => ({
      ...prev,
      tableSizesByDay: {
        ...prev.tableSizesByDay,
        [currentDayId]: {
          ...prev.tableSizesByDay?.[currentDayId],
          right: typeof newSize === "function" ? newSize(prev.tableSizesByDay?.[currentDayId]?.right || 8) : newSize,
        },
      },
    }));
  };

  const addCrewMember = (personId) => {
    const person = castCrew.find((p) => p.id === personId && p.type === "crew");
    if (person && !assignedCrew.find((c) => c.personId === personId)) {
      const newCrewMember = {
        id: `assigned_${Date.now()}_${personId}`,
        personId: person.id,
        displayName: person.displayName || person.name,
        position: person.position || person.crewDepartment || person.department,
        department: person.crewDepartment || person.department || "Other",
        phone: person.phone || "",
      };
      setAssignedCrew((prev) => [...prev, newCrewMember]);

      if (selectedDay) {
        const shootingDate = selectedDay.date;

        const updatedCastCrew = castCrew.map((p) => {
          if (p.id === personId) {
            const currentDates = p.availability?.bookedDates || [];
            if (!currentDates.includes(shootingDate)) {
              return {
                ...p,
                availability: {
                  ...p.availability,
                  bookedDates: [...currentDates, shootingDate].sort(),
                },
              };
            }
          }
          return p;
        });
        onUpdateCastCrew(updatedCastCrew);

        if (person && !person.availability?.bookedDates?.includes(shootingDate)) {
          database
            .addAvailabilityDateSafe(selectedProject, personId, shootingDate, "booked")
            .catch((error) => {
              console.error("Failed to add booked date:", error);
            });
        }
      }
    }
  };

  const removeCrewMember = (assignedId) => {
    if (!selectedDay) return;

    const crewMember = assignedCrew.find((c) => c.id === assignedId);
    if (!crewMember) return;

    const person = castCrew.find((p) => p.id === crewMember.personId);
    const isBooked = person?.availability?.bookedDates?.includes(selectedDay.date) || false;

    if (isBooked) {
      setRemovalModal({ crewMember, person, assignedId });
    } else {
      setAssignedCrew((prev) => prev.filter((c) => c.id !== assignedId));
    }
  };

  const handleRemovalYes = () => {
    const { assignedId, person } = removalModal;

    setAssignedCrew((prev) => prev.filter((c) => c.id !== assignedId));

    if (selectedDay) {
      const shootingDate = selectedDay.date;

      const updatedCastCrew = castCrew.map((p) => {
        if (p.id === person.id) {
          return {
            ...p,
            availability: {
              ...p.availability,
              bookedDates: (p.availability?.bookedDates || []).filter((date) => date !== shootingDate),
            },
          };
        }
        return p;
      });
      onUpdateCastCrew(updatedCastCrew);

      database
        .removeAvailabilityDateSafe(selectedProject, person.id, shootingDate, "booked")
        .catch((error) => {
          console.error("Failed to remove booked date:", error);
        });
    }

    setRemovalModal(null);
  };

  const handleRemovalNo = () => {
    const { assignedId } = removalModal;
    setAssignedCrew((prev) => prev.filter((c) => c.id !== assignedId));
    setRemovalModal(null);
  };

  const handleRemovalCancel = () => {
    setRemovalModal(null);
  };

  const getAvailableCrew = () => {
    const assignedPersonIds = assignedCrew.map((c) => c.personId);
    return castCrew.filter(
      (person) => person.type === "crew" && !assignedPersonIds.includes(person.id)
    );
  };

  const getCrewByDepartmentGroups = () => {
    const grouped = {};
    assignedCrew.forEach((crew) => {
      const dept = crew.department || "Other";
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(crew);
    });

    const departmentOrder = [
      "Principal Crew", "Producer", "Camera", "G&E", "Art", "Wardrobe",
      "Makeup", "Sound", "Script", "Production", "Transportation",
      "Craft Services", "Stunts", "Other",
    ];

    const sortedGroups = {};
    departmentOrder.forEach((dept) => {
      if (grouped[dept]) {
        sortedGroups[dept] = grouped[dept].sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        );
      }
    });

    return sortedGroups;
  };

  const distributeCrewToTables = () => {
    const groupedCrew = getCrewByDepartmentGroups();
    const leftTable = [];
    const rightTable = [];
    let leftUsed = 0;
    let rightUsed = 0;

    Object.entries(groupedCrew).forEach(([department, crew]) => {
      const deptSize = crew.length + 1;

      if (leftUsed + deptSize <= leftTableSize) {
        leftTable.push({ type: "header", department });
        crew.forEach((member) => leftTable.push({ type: "crew", ...member }));
        leftUsed += deptSize;
      } else if (rightUsed + deptSize <= rightTableSize) {
        rightTable.push({ type: "header", department });
        crew.forEach((member) => rightTable.push({ type: "crew", ...member }));
        rightUsed += deptSize;
      }
    });

    return { leftTable, rightTable, leftUsed, rightUsed };
  };

  const currentDayHiddenCast = callSheetData.hiddenCastByDay?.[currentDayId] || [];

  const setHiddenCast = (hiddenCastList) => {
    if (!currentDayId) return;
    setCallSheetData((prev) => ({
      ...prev,
      hiddenCastByDay: { ...prev.hiddenCastByDay, [currentDayId]: hiddenCastList },
    }));
  };

  const toggleCastVisibility = (characterName) => {
    const newHiddenList = currentDayHiddenCast.includes(characterName)
      ? currentDayHiddenCast.filter((name) => name !== characterName)
      : [...currentDayHiddenCast, characterName];
    setHiddenCast(newHiddenList);
  };

  const isCastHidden = (characterName) => currentDayHiddenCast.includes(characterName);

  const setCallTime = (value) => {
    if (!currentDayId) return;
    const newCallSheetData = {
      ...callSheetData,
      callTimeByDay: { ...callSheetData.callTimeByDay, [currentDayId]: value },
    };
    setCallSheetData(newCallSheetData);
    if (syncCallSheetData) syncCallSheetData(newCallSheetData);
  };

  const setDayNotes = (value) => {
    if (!currentDayId) return;
    const newCallSheetData = {
      ...callSheetData,
      notesByDay: { ...callSheetData.notesByDay, [currentDayId]: value },
    };
    setCallSheetData(newCallSheetData);
    // ADD SYNC CALL
    // {
    //  syncCallSheetData(newCallSheetData);
    //}
  };

  const callTime = currentDayCallTime;

  const setCastCallTimes = (value) => {
    const newCallSheetData = { ...callSheetData, castCallTimes: value };
    setCallSheetData(newCallSheetData);
    // ADD SYNC CALL
    //if (syncCallSheetData) {
    //  syncCallSheetData(newCallSheetData);
    //}
  };

  const setCustomNotes = (value) => {
    const newCallSheetData = { ...callSheetData, customNotes: value };
    setCallSheetData(newCallSheetData);
    // ADD SYNC CALL
    //if (syncCallSheetData) {
    //  syncCallSheetData(newCallSheetData);
    //}
  };

  React.useEffect(() => {
    if (shootingDays.length > 0 && selectedDay === null && !initialDayNumber) {
      const smartDefault = getSmartDefaultDay(shootingDays);
      setSelectedDay(smartDefault);
    }
  }, [shootingDays]);

  React.useEffect(() => {
    if (selectedDay) {
      const scenes = getScheduledScenes();
      let filmingLocation = "Los Angeles, CA, USA";

      if (scenes.length > 0) {
        const firstScene = scenes[0];

        const matchingScriptLocation = scriptLocations.find(
          (scriptLoc) =>
            scriptLoc.scenes &&
            (scriptLoc.scenes.includes(parseInt(firstScene.scene)) ||
              scriptLoc.scenes.includes(firstScene.scene.toString()))
        );

        if (matchingScriptLocation && matchingScriptLocation.actualLocationId) {
          const actualLocation = actualLocations.find(
            (actual) => actual.id === matchingScriptLocation.actualLocationId
          );
          if (actualLocation) {
            const locationParts = [actualLocation.city, actualLocation.state].filter(Boolean);
            if (locationParts.length > 0) filmingLocation = locationParts.join(", ") + ", USA";
            if (actualLocation.address) {
              const fullAddress = [actualLocation.address, actualLocation.city, actualLocation.state, actualLocation.zipCode].filter(Boolean).join(", ");
              findNearestHospital(fullAddress);
            }
          }
        } else if (firstScene.location) {
          filmingLocation = firstScene.location + ", CA, USA";
          findNearestHospital(firstScene.location);
        }
      }

      fetchWeather(selectedDay.date, filmingLocation);

      const autoPopulateTimer = setTimeout(() => {
        const bookedCrew = castCrew.filter(
          (person) =>
            person.type === "crew" &&
            person.availability?.bookedDates &&
            person.availability?.bookedDates.includes(selectedDay.date)
        );

        const currentAssignedIds = (
          callSheetData.crewByDay?.[selectedDay.id]?.assignedCrew || []
        ).map((c) => c.personId);

        const crewToAdd = bookedCrew.filter(
          (person) => !currentAssignedIds.includes(person.id)
        );

        if (crewToAdd.length > 0) {
          const newCrewMembers = crewToAdd.map((person) => ({
            id: `assigned_${Date.now()}_${person.id}_${Math.random()}`,
            personId: person.id,
            displayName: person.displayName || person.name,
            position: person.position || person.crewDepartment || person.department,
            department: person.crewDepartment || person.department || "Other",
            phone: person.phone || "",
          }));

          setCallSheetData((prevData) => {
            const defaultCallTime = prevData.callTimeByDay?.[selectedDay.id] || "7:00 AM";

            const updatedCrewList = [
              ...(prevData.crewByDay?.[selectedDay.id]?.assignedCrew || []),
              ...newCrewMembers,
            ];

            const updatedCrewCallTimes = { ...prevData.crewCallTimes };
            newCrewMembers.forEach((crew) => {
              updatedCrewCallTimes[crew.id] = defaultCallTime;
            });

            const newCallSheetData = {
              ...prevData,
              crewByDay: {
                ...prevData.crewByDay,
                [selectedDay.id]: {
                  ...prevData.crewByDay?.[selectedDay.id],
                  assignedCrew: updatedCrewList,
                },
              },
              crewCallTimes: updatedCrewCallTimes,
            };

            if (syncCallSheetData) {
              syncCallSheetData(newCallSheetData).catch((error) => {
                console.error("❌ Failed to sync auto-populated crew:", error);
              });
            }

            return newCallSheetData;
          });
        }
      }, 500);

      return () => clearTimeout(autoPopulateTimer);
    }
  }, [selectedDay]);

  const findNearestHospital = (locationAddress) => {
    if (!locationAddress) return;
    const location = locationAddress.toLowerCase();
    const sortedAreas = Object.entries(LA_AREA_HOSPITALS).sort(([a], [b]) => b.length - a.length);
    for (const [area, hospital] of sortedAreas) {
      if (location.includes(area)) {
        setProjectSettings((prev) => ({ ...prev, nearestHospital: hospital }));
        return;
      }
    }
    setProjectSettings((prev) => ({
      ...prev,
      nearestHospital: { name: "Good Samaritan Hospital", phone: "(213) 977-2121", address: "1225 Wilshire Blvd, Los Angeles, CA 90017" },
    }));
  };

  const fetchWeather = async (date, location = "Los Angeles, CA, USA") => {
    try {
      const formattedDate = date.includes("T") ? date.split("T")[0] : date;
      const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}/${formattedDate}?unitGroup=us&include=days&key=72QJGX7PW23X2MGU44ZCN4756&contentType=json`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API response not ok: ${response.status}`);
      const data = await response.json();
      if (data.days && data.days.length > 0) {
        const dayData = data.days[0];
        const formatTime = (timeStr) => {
          const [hours, minutes] = timeStr.split(":");
          const hour = parseInt(hours);
          const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
          const period = hour >= 12 ? "PM" : "AM";
          return `${displayHour}:${minutes} ${period}`;
        };
        const sunrise = formatTime(dayData.sunrise);
        const sunset = formatTime(dayData.sunset);
        const temp = Math.round(dayData.temp || 72);
        const conditions = dayData.conditions || "Clear";
        const conditionsLower = conditions.toLowerCase();
        let condition = "Clear";
        if (conditionsLower.includes("rain") || conditionsLower.includes("shower")) condition = "Rainy";
        else if (conditionsLower.includes("cloud") || conditionsLower.includes("overcast")) condition = "Partly Cloudy";
        else if (conditionsLower.includes("clear") || conditionsLower.includes("sun")) condition = "Clear";
        else if (conditionsLower.includes("fog") || conditionsLower.includes("mist")) condition = "Foggy";
        else if (conditionsLower.includes("snow")) condition = "Snowy";
        else if (conditionsLower.includes("storm") || conditionsLower.includes("thunder")) condition = "Stormy";
        else condition = conditions;
        setWeather({ temp, condition, sunrise, sunset });
      } else {
        throw new Error("No weather data in response");
      }
    } catch (error) {
      console.error("Weather fetch error:", error);
      setWeather({ temp: 72, condition: "Partly Cloudy", sunrise: "6:45 AM", sunset: "7:30 PM" });
    }
  };

  const calculateCallTime = () => {
    return;
  };

  const getScheduledScenes = () => {
    if (!selectedDay) return [];

    const scheduledScenesForDate = scheduledScenes[selectedDay.date] || [];

    const scheduleBlockScenes = selectedDay.scheduleBlocks
      ? selectedDay.scheduleBlocks
          .filter((block) => block.scene || block.isLunch || block.customItem)
          .map((block) => {
            if (block.isLunch) {
              return { time: block.time, scene: "LUNCH", ie: "", location: "LUNCH", cast: "", dn: "", pages: "", wardrobe: "", props: "", notes: "" };
            }
            if (block.customItem) {
              return { time: block.time, scene: block.customItem.toUpperCase(), ie: "", location: block.customItem, cast: "", dn: "", pages: "", wardrobe: "", props: "", notes: "Custom schedule item" };
            }
            const scene = block.scene;
            const mainScene = callSheetScenes.find((s) => s.sceneNumber == scene.sceneNumber);
            return {
              time: block.time,
              scene: scene.sceneNumber,
              ie: scene.metadata?.intExt || "",
              location: scene.shootingLocation || scene.metadata?.location || "",
              cast: getSceneCast(scene.sceneNumber),
              dn: scene.metadata?.timeOfDay || "",
              pages: mainScene?.pageLength || scene.pageLength || "1/8",
              wardrobe: getSceneWardrobe(scene.sceneNumber),
              props: getSceneProps(scene.sceneNumber),
              notes: scene.description || "",
            };
          })
      : [];

    if (scheduleBlockScenes.length > 0) return scheduleBlockScenes;

    return scheduledScenesForDate.map((scene) => ({
      time: scene.scheduledTime || "8:00 AM",
      scene: scene.sceneNumber,
      ie: scene.metadata?.intExt || "",
      location: scene.shootingLocation || scene.metadata?.location || "",
      cast: getSceneCast(scene.sceneNumber),
      dn: scene.metadata?.timeOfDay || "",
      pages: scene.pageLength || "1/8",
      wardrobe: getSceneWardrobe(scene.sceneNumber),
      props: getSceneProps(scene.sceneNumber),
      notes: scene.description || "",
    }));
  };

  const getSceneCast = (sceneNumber) => {
    if (!characters) return "";
    const sceneCharacters = Object.values(characters)
      .filter((char) => {
        const finalScenes = getFinalCharacterScenes(char.name);
        const sceneNum = parseInt(sceneNumber);
        return finalScenes.includes(sceneNum);
      })
      .sort((a, b) => a.chronologicalNumber - b.chronologicalNumber);
    return sceneCharacters
      .map((char) => {
        const castMember = castCrew.find((person) => person.type === "cast" && person.character === char.name);
        const actorName = castMember?.displayName || "TBD";
        return `${char.chronologicalNumber}. ${actorName}`;
      })
      .join(", ");
  };

  const getSceneWardrobe = (sceneNumber) => {
    if (!wardrobeItems || wardrobeItems.length === 0) return "";
    const wardrobeForScene = [];
    wardrobeItems.forEach((character) => {
      if (character.items) {
        character.items.forEach((item) => {
          if (item.scenes && item.scenes.includes(parseInt(sceneNumber))) {
            wardrobeForScene.push(`${character.characterName} ${item.number}`);
          }
        });
      }
    });
    return wardrobeForScene.join(", ");
  };

  const getSceneProps = (sceneNumber) => {
    if (!taggedItems) return "";
    const sceneArrayIndex = callSheetScenes.findIndex(
      (s) => String(s.sceneNumber) === String(sceneNumber)
    );

    const getEarliestScene = (prop) => {
      const nums = (prop.scenes || []).map((n) => parseFloat(n)).filter((n) => !isNaN(n));
      return nums.length > 0 ? Math.min(...nums) : Infinity;
    };
    const sortedProps = Object.entries(taggedItems)
      .filter(([, item]) => item.category === "Props")
      .sort((a, b) => {
        const d = getEarliestScene(a[1]) - getEarliestScene(b[1]);
        return d !== 0 ? d : (a[1].chronologicalNumber || 0) - (b[1].chronologicalNumber || 0);
      });
    const propNumberMap = Object.fromEntries(sortedProps.map(([word], idx) => [word, idx + 1]));

    const propEntries = [];
    Object.entries(taggedItems).forEach(([word, item]) => {
      if (item.category && item.category.toLowerCase() === "props") {
        const inScenesArray = (item.scenes || []).some((s) => String(s) === String(sceneNumber));
        const inInstances = sceneArrayIndex >= 0 && (item.instances || []).some((instance) => {
          if (typeof instance === "string") return parseInt(instance.split("-")[0]) === sceneArrayIndex;
          return false;
        });
        if (inScenesArray || inInstances) {
          const num = propNumberMap[word] || item.chronologicalNumber || "";
          const name = item.customTitle || item.displayName || word;
          propEntries.push({ num, name });
        }
      }
    });

    return propEntries
      .sort((a, b) => (a.num || 999) - (b.num || 999))
      .map(({ num, name }) => `${num}. ${name}`)
      .join(", ");
  };

  const getCastForDay = () => {
    const scenes = getScheduledScenes();
    const characterNumbers = new Set();

    scenes.forEach((scene) => {
      if (scene.cast) {
        scene.cast.split(", ").forEach((castEntry) => {
          const match = castEntry.match(/^(\d+)\./);
          if (match) characterNumbers.add(parseInt(match[1]));
        });
      }
    });

    manualCast.forEach((castId) => {
      const castMember = castCrew.find((person) => person.type === "cast" && person.id === castId);
      if (castMember) {
        const char = Object.values(characters).find((c) => c.name === castMember.character);
        if (char) characterNumbers.add(char.chronologicalNumber);
      }
    });

    const dayCharacters = Object.values(characters)
      .filter((char) => characterNumbers.has(char.chronologicalNumber))
      .filter((char) => {
        const wasManuallyAdded = manualCast.some((castId) => {
          const castMember = castCrew.find((p) => p.id === castId);
          return castMember?.character === char.name;
        });
        if (wasManuallyAdded) return true;
        return !isCastHidden(char.name);
      })
      .sort((a, b) => a.chronologicalNumber - b.chronologicalNumber);

    return dayCharacters.map((char) => {
      const castMember = castCrew.find((person) => person.type === "cast" && person.character === char.name);
      const currentCallTimes = callSheetData.castCallTimes[currentDayId]?.[char.name] || {};
      const defaultMakeupTime = (() => {
        if (!callTime) return "";
        try {
          const [time, period] = callTime.split(" ");
          const [hours, minutes] = time.split(":").map(Number);
          let totalMinutes = (hours % 12) * 60 + minutes;
          if (period === "PM" && hours !== 12) totalMinutes += 12 * 60;
          if (period === "AM" && hours === 12) totalMinutes = minutes;
          totalMinutes -= 60;
          if (totalMinutes < 0) totalMinutes += 24 * 60;
          const newHours = Math.floor(totalMinutes / 60) % 24;
          const newMinutes = totalMinutes % 60;
          const displayHours = newHours === 0 ? 12 : newHours > 12 ? newHours - 12 : newHours;
          const displayPeriod = newHours < 12 ? "AM" : "PM";
          return `${displayHours}:${newMinutes.toString().padStart(2, "0")} ${displayPeriod}`;
        } catch (e) {
          return "";
        }
      })();

      return {
        number: char.chronologicalNumber,
        cast: castMember?.displayName || "TBD",
        character: char.name,
        makeup: currentCallTimes.makeup !== undefined ? currentCallTimes.makeup : defaultMakeupTime,
        set: currentCallTimes.set !== undefined ? currentCallTimes.set : callTime,
        specialInstructions: castMember?.notes || "",
      };
    });
  };

  const addManualCast = (castId) => {
    if (!castId || manualCast.includes(castId)) return;
    setManualCast((prev) => [...prev, castId]);
  };

  const removeManualCast = (castId) => {
    setManualCast((prev) => prev.filter((id) => id !== castId));
  };

  const getAvailableCast = () => {
    const dayCharacterNames = daycast.map((c) => c.character);
    return castCrew.filter(
      (person) =>
        person.type === "cast" &&
        !dayCharacterNames.includes(person.character) &&
        !manualCast.includes(person.id)
    );
  };

  const getCrewByDepartment = () => {
    const departments = [
      "Principal Crew", "Producer", "Camera", "G&E", "Art", "Wardrobe",
      "Makeup", "Sound", "Script", "Transportation", "Craft Services", "Other",
    ];
    const organizedCrew = {};
    departments.forEach((dept) => {
      organizedCrew[dept] = castCrew.filter(
        (person) => person.type === "crew" && (person.crewDepartment || "Other") === dept
      );
    });
    return organizedCrew;
  };

  const updateCastCallTime = (characterName, field, value) => {
    if (!currentDayId) return;
    const newCallSheetData = {
      ...callSheetData,
      castCallTimes: {
        ...callSheetData.castCallTimes,
        [currentDayId]: {
          ...callSheetData.castCallTimes[currentDayId],
          [characterName]: {
            ...callSheetData.castCallTimes[currentDayId]?.[characterName],
            [field]: value,
          },
        },
      },
    };
    setCallSheetData(newCallSheetData);
    if (syncCallSheetData) syncCallSheetData(newCallSheetData);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
  };

  const formatDateWithDay = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const formattedDate = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
    return `${dayName} - ${formattedDate}`;
  };

  const printCallSheet = () => {
    window.print();
  };

  const scenes = getScheduledScenes();
  const daycast = getCastForDay();
  const crewByDept = getCrewByDepartment();

  const parsePageLengthToEighths = (pageStr) => {
    if (!pageStr) return 0;
    const parts = String(pageStr).trim().split(" ");
    if (parts.length === 1) {
      if (parts[0].includes("/")) {
        const [num, denom] = parts[0].split("/").map(Number);
        return num;
      }
      return parseInt(parts[0]) * 8;
    } else {
      const wholeNumber = parseInt(parts[0]);
      const [num, denom] = parts[1].split("/").map(Number);
      return wholeNumber * 8 + num;
    }
  };

  const eighthsToDisplayFormat = (eighths) => {
    const wholePages = Math.floor(eighths / 8);
    const remainderEighths = eighths % 8;
    if (remainderEighths === 0) return wholePages.toString();
    else if (wholePages === 0) return `${remainderEighths}/8`;
    else return `${wholePages} ${remainderEighths}/8`;
  };

  const totalEighths = scenes.reduce((total, scene) => total + parsePageLengthToEighths(scene.pages), 0);
  const totalPages = eighthsToDisplayFormat(totalEighths);

  if (shootingDays.length === 0) {
    return (
      <div style={{ padding: "20px", width: "100%", height: "calc(100vh - 40px)", overflowY: "auto", boxSizing: "border-box" }}>
        <h2>Call Sheet</h2>
        <p>No shooting days scheduled. Please add shooting days in the Schedule module first.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", height: "calc(100vh - 44px)", width: "100%", maxWidth: "100vw", overflowY: "auto", overflowX: "auto", fontFamily: "Arial, sans-serif", boxSizing: "border-box" }}>
      {/* Controls */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "15px", alignItems: "center" }}>
        <div>
          <label style={{ fontWeight: "bold", marginRight: "8px" }}>Shooting Day:</label>
          <select
            value={selectedDay?.id || ""}
            onChange={(e) => {
              const dayId = e.target.value;
              const day = shootingDays.find((d) => String(d.id) === String(dayId));
              setSelectedDay(day);
            }}
            style={{ padding: "4px 8px", fontSize: "14px" }}
          >
            {shootingDays.map((day) => {
              const date = new Date(day.date + "T00:00:00");
              const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
              const formattedDate = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
              return (
                <option key={day.id} value={day.id}>
                  Day {day.dayNumber} {dayName} {formattedDate}
                </option>
              );
            })}
          </select>
        </div>
        <button onClick={exportCallSheetPDF} style={{ backgroundColor: "#f44336", color: "white", padding: "6px 12px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Export Call Sheet</button>
        <button onClick={exportSidesPDF} style={{ backgroundColor: "#9C27B0", color: "white", padding: "6px 12px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Export Sides</button>
      </div>

      {/* Call Sheet */}
      <div style={{ transform: "scale(1.3)", transformOrigin: "top center", marginBottom: "30%" }}>
        <div data-call-sheet="true" style={{ backgroundColor: "white", border: "2px solid black", fontSize: "10px", width: "8.5in", minHeight: "11in", maxWidth: "8.5in", margin: "0 auto", boxSizing: "border-box", padding: "0.25in" }}>
          {/* Header */}
          <div style={{ display: "flex", borderBottom: "2px solid black" }}>
            <div style={{ flex: "1", padding: "6px", borderRight: "1px solid black", fontSize: "9px" }}>
              <div><strong>Producer:</strong> {projectSettings.producer || "TBD"}</div>
              <div><strong>Director:</strong> {projectSettings.director || "TBD"}</div>
              <div><strong>Hospital:</strong> {projectSettings.nearestHospital?.name || "Loading..."}</div>
              <div><strong>Phone:</strong> {projectSettings.nearestHospital?.phone || "(xxx) xxx-xxxx"}</div>
              <div>{projectSettings.nearestHospital?.address || "Fetching nearest hospital..."}</div>
            </div>
            <div style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ccc", fontWeight: "bold", fontSize: "18px", padding: "4px" }}>
              {projectSettings.filmTitle || "FILM TITLE"}
            </div>
            <div style={{ flex: "1", padding: "6px", borderLeft: "1px solid black", fontSize: "9px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "17px", fontWeight: "bold" }}>{selectedDay ? formatDate(selectedDay.date) : ""}</span>
                <span>Day {selectedDay?.dayNumber || 1} of {shootingDays.length}</span>
              </div>
              <div style={{ marginTop: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>SU</span><span>SUNSET</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>{weather?.sunrise || "6:45 AM"}</span><span>{weather?.sunset || "7:30 PM"}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>WE {weather?.temp || 72}°</span><span>HI {weather?.temp + 5 || 77}°</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>HU 10%</span><span>{weather?.condition || "Sunny"}</span></div>
              </div>
            </div>
          </div>

          {/* Notes and Call Time */}
          <div style={{ display: "flex", borderBottom: "1px solid black" }}>
            <div style={{ flex: "2", padding: "8px", borderRight: "1px solid black", minHeight: "60px" }}>
              <div style={{ marginBottom: "4px" }}><strong>NOTES:</strong></div>
              <textarea
                value={currentDayNotes}
                onChange={(e) => setDayNotes(e.target.value)}
                placeholder="Enter notes for this shooting day..."
                style={{ width: "calc(100% - 8px)", height: "40px", border: "1px solid #ccc", borderRadius: "3px", padding: "4px", fontSize: "11px", fontFamily: "Arial, sans-serif", resize: "none" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid black", margin: "10px", fontWeight: "bold", fontSize: "16px" }}>
              <span style={{ padding: "5px 10px", borderRight: "2px solid black" }}>CALL</span>
              <span style={{ padding: "5px 10px" }}>
                <input type="text" value={callTime} onChange={(e) => setCallTime(e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                  style={{ border: "none", fontSize: "16px", fontWeight: "bold", width: "80px", textAlign: "center" }} />
              </span>
            </div>
            <div style={{ flex: "2" }}></div>
          </div>

          {/* Scenes Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ border: "1px solid black", padding: "2px", width: "55px", fontSize: "8px" }}>TIME</th>
                <th style={{ border: "1px solid black", padding: "2px", width: "40px", fontSize: "8px" }}>SC</th>
                <th style={{ border: "1px solid black", padding: "2px", width: "25px", fontSize: "8px" }}>I/E</th>
                <th style={{ border: "1px solid black", padding: "2px", width: "15%" }}>LOCATION/DESC</th>
                <th style={{ border: "1px solid black", padding: "2px", width: "14%", fontSize: "8px" }}>CAST</th>
                <th style={{ border: "1px solid black", padding: "2px", width: "25px", fontSize: "8px" }}>D/N</th>
                <th style={{ border: "1px solid black", padding: "2px", width: "30px", fontSize: "8px" }}>PG#</th>
                <th style={{ border: "1px solid black", padding: "2px", width: "40px", fontSize: "8px" }}>PGS</th>
                <th style={{ border: "1px solid black", padding: "2px", width: "10.5%", fontSize: "8px" }}>WARDROBE</th>
                <th style={{ border: "1px solid black", padding: "2px", width: "10.5%", fontSize: "8px" }}>PROPS</th>
                <th style={{ border: "1px solid black", padding: "2px", width: "20%", fontSize: "8px" }}>LOCATION</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const locationGroups = [];
                let currentGroup = null;

                scenes.forEach((scene, index) => {
                  if (scene.scene === "LUNCH" || scene.scene === "ADR") {
                    if (currentGroup) currentGroup.endIndex = index;
                    return;
                  }

                  let physicalAddress = scene.location || "Unknown Location";
                  const matchingScriptLocation = scriptLocations.find(
                    (scriptLoc) =>
                      scriptLoc.scenes &&
                      (scriptLoc.scenes.includes(parseInt(scene.scene)) ||
                        scriptLoc.scenes.includes(scene.scene.toString()))
                  );
                  if (matchingScriptLocation && matchingScriptLocation.actualLocationId) {
                    const actualLocation = actualLocations.find((actual) => actual.id === matchingScriptLocation.actualLocationId);
                    if (actualLocation && actualLocation.address) {
                      const addressParts = [actualLocation.address, actualLocation.city, actualLocation.state, actualLocation.zipCode].filter(Boolean);
                      physicalAddress = addressParts.length > 1 ? addressParts.join(", ") : actualLocation.address;
                    }
                  }

                  const normalizedLocation = physicalAddress.toLowerCase().trim();

                  if (!currentGroup || currentGroup.normalizedLocation !== normalizedLocation) {
                    if (currentGroup) {
                      currentGroup.rowSpan = currentGroup.endIndex - currentGroup.startIndex + 1;
                      locationGroups.push(currentGroup);
                    }
                    currentGroup = { normalizedLocation, displayAddress: physicalAddress, startIndex: index, endIndex: index, rowSpan: 1 };
                  } else {
                    currentGroup.endIndex = index;
                  }
                });

                if (currentGroup) {
                  currentGroup.rowSpan = currentGroup.endIndex - currentGroup.startIndex + 1;
                  locationGroups.push(currentGroup);
                }

                return scenes.map((scene, index) => {
                  if (scene.scene === "LUNCH") {
                    return (
                      <tr key={index} style={{ backgroundColor: "#90EE90" }}>
                        <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px", whiteSpace: "nowrap", textAlign: "center" }}>{scene.time}</td>
                        <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px", textAlign: "center", fontWeight: "bold", backgroundColor: "#90EE90" }} colSpan={9}>LUNCH</td>
                      </tr>
                    );
                  }

                  let physicalAddress = scene.location || "Unknown Location";
                  const matchingScriptLocation = scriptLocations.find(
                    (scriptLoc) =>
                      scriptLoc.scenes &&
                      (scriptLoc.scenes.includes(parseInt(scene.scene)) ||
                        scriptLoc.scenes.includes(scene.scene.toString()))
                  );
                  if (matchingScriptLocation && matchingScriptLocation.actualLocationId) {
                    const actualLocation = actualLocations.find((actual) => actual.id === matchingScriptLocation.actualLocationId);
                    if (actualLocation && actualLocation.address) {
                      const addressParts = [actualLocation.address, actualLocation.city, actualLocation.state, actualLocation.zipCode].filter(Boolean);
                      physicalAddress = addressParts.length > 1 ? addressParts.join(", ") : actualLocation.address;
                    }
                  }

                  return (
                    <tr key={index} style={{ backgroundColor: "white" }}>
                      <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px", textAlign: "center", whiteSpace: "nowrap" }}>{scene.time}</td>
                      <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px", textAlign: "center" }}>{scene.scene}</td>
                      <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px", textAlign: "center" }}>{scene.ie}</td>
                      <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px" }}>
                        {scene.location}
                        {scene.notes && <div style={{ fontSize: "7px", color: "#666" }}>{scene.notes}</div>}
                      </td>
                      <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px" }}>{scene.cast}</td>
                      <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px", textAlign: "center" }}>{scene.dn}</td>
                      <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px", textAlign: "center" }}>
                        {(() => { const s = stripboardScenes.find((s) => s.sceneNumber == scene.scene); return s?.pageNumber || "1"; })()}
                      </td>
                      <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px", textAlign: "center" }}>
                        {(() => { const m = callSheetScenes.find((s) => s.sceneNumber == scene.scene); return m?.pageLength || "1/8"; })()}
                      </td>
                      <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px" }}>{scene.wardrobe}</td>
                      <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px" }}>{scene.props}</td>
                      {scene.scene !== "LUNCH" && scene.scene !== "ADR" && (() => {
                        const locationGroup = locationGroups.find((group) => group.startIndex === index);
                        if (locationGroup) {
                          return (
                            <td style={{ border: "1px solid black", padding: "2px", fontSize: "8px", textAlign: "center", backgroundColor: "white", verticalAlign: "middle" }} rowSpan={locationGroup.rowSpan}>
                              {locationGroup.displayAddress}
                            </td>
                          );
                        }
                        return null;
                      })()}
                    </tr>
                  );
                });
              })()}
              <tr>
                <td colSpan="7" style={{ border: "1px solid black", padding: "4px", textAlign: "center", fontWeight: "bold" }}>TOTAL PAGES</td>
                <td style={{ border: "1px solid black", padding: "4px", fontWeight: "bold", textAlign: "center" }}>{totalPages}</td>
                <td colSpan="3" style={{ border: "1px solid black", padding: "4px" }}></td>
              </tr>
            </tbody>
          </table>

          {/* Cast Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ border: "1px solid black", padding: "4px", width: "40px" }}>#</th>
                <th style={{ border: "1px solid black", padding: "4px" }}>CAST</th>
                <th style={{ border: "1px solid black", padding: "4px" }}>CHARACTER</th>
                <th style={{ border: "1px solid black", padding: "4px", width: "60px" }}>MU</th>
                <th style={{ border: "1px solid black", padding: "4px", width: "60px" }}>SET</th>
                <th style={{ border: "1px solid black", padding: "4px" }}>SPECIAL INSTRUCTIONS</th>
              </tr>
            </thead>
            <tbody>
              {daycast.map((cast, index) => {
                const isHidden = isCastHidden(cast.character);
                const rowStyle = { backgroundColor: isHidden ? "#f0f0f0" : "white", opacity: isHidden ? 0.6 : 1, textDecoration: isHidden ? "line-through" : "none" };
                return (
                  <tr key={index} style={rowStyle}>
                    <td style={{ border: "1px solid black", padding: "4px", textAlign: "center" }}>
                      {cast.number}
                      {manualCast.some((id) => castCrew.find((p) => p.id === id)?.character === cast.character) && (
                        <button onClick={() => { const castMember = castCrew.find((p) => p.character === cast.character); if (castMember) removeManualCast(castMember.id); }}
                          style={{ marginLeft: "5px", padding: "1px 4px", fontSize: "8px", backgroundColor: "#ff9800", color: "white", border: "none", borderRadius: "2px", cursor: "pointer" }} title="Remove manually added cast">−</button>
                      )}
                      <button onClick={() => toggleCastVisibility(cast.character)}
                        style={{ marginLeft: "5px", padding: "1px 4px", fontSize: "8px", backgroundColor: isHidden ? "#4CAF50" : "#f44336", color: "white", border: "none", borderRadius: "2px", cursor: "pointer" }}
                        title={isHidden ? "Show cast member" : "Hide cast member"}>{isHidden ? "+" : "×"}</button>
                    </td>
                    <td style={{ border: "1px solid black", padding: "4px", color: isHidden ? "#888" : "black" }}>{cast.cast}</td>
                    <td style={{ border: "1px solid black", padding: "4px", color: isHidden ? "#888" : "black" }}>{cast.character}</td>
                    <td style={{ border: "1px solid black", padding: "4px" }}>
                      <input type="text" value={cast.makeup} onChange={(e) => updateCastCallTime(cast.character, "makeup", e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        style={{ width: "50px", border: "none", fontSize: "11px", backgroundColor: isHidden ? "transparent" : "white", color: isHidden ? "#888" : "black" }} disabled={isHidden} />
                    </td>
                    <td style={{ border: "1px solid black", padding: "4px" }}>
                      <input type="text" value={cast.set} onChange={(e) => updateCastCallTime(cast.character, "set", e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        style={{ width: "50px", border: "none", fontSize: "11px", backgroundColor: isHidden ? "transparent" : "white", color: isHidden ? "#888" : "black" }} disabled={isHidden} />
                    </td>
                    <td style={{ border: "1px solid black", padding: "4px", color: isHidden ? "#888" : "black" }}>{cast.specialInstructions}</td>
                  </tr>
                );
              })}
              <tr style={{ backgroundColor: "#e3f2fd" }}>
                <td style={{ border: "1px solid black", padding: "4px", textAlign: "center" }}>+</td>
                <td colSpan="2" style={{ border: "1px solid black", padding: "4px" }}>
                  <select onChange={(e) => { if (e.target.value) { addManualCast(e.target.value); e.target.value = ""; } }} style={{ width: "100%", fontSize: "11px" }}>
                    <option value="">Add cast member...</option>
                    {getAvailableCast().map((person) => (
                      <option key={person.id} value={person.id}>{person.displayName || person.name} ({person.character})</option>
                    ))}
                  </select>
                </td>
                <td style={{ border: "1px solid black", padding: "4px" }}></td>
                <td style={{ border: "1px solid black", padding: "4px" }}></td>
                <td style={{ border: "1px solid black", padding: "4px" }}><em style={{ fontSize: "10px", color: "#666" }}>Select to add cast not in scenes</em></td>
              </tr>
              {[...Array(Math.max(0, 0))].map((_, index) => (
                <tr key={`empty-${index}`}>
                  <td style={{ border: "1px solid black", padding: "4px", height: "25px" }}></td>
                  <td style={{ border: "1px solid black", padding: "4px" }}></td>
                  <td style={{ border: "1px solid black", padding: "4px" }}></td>
                  <td style={{ border: "1px solid black", padding: "4px" }}></td>
                  <td style={{ border: "1px solid black", padding: "4px" }}></td>
                  <td style={{ border: "1px solid black", padding: "4px" }}></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Production Notes */}
          <div style={{ borderTop: "1px solid black", marginTop: "10px", width: "100%" }}>
            <div style={{ backgroundColor: "#f0f0f0", padding: "3px", textAlign: "center", fontWeight: "bold", borderBottom: "1px solid black", fontSize: "10px", width: "100%" }}>PRODUCTION NOTES</div>
            <div style={{ display: "flex", width: "100%" }}>
              <div style={{ flex: "1", padding: "4px" }}>
                {productionNotes.slice(0, 2).map((note, index) => (
                  <div key={index} style={{ marginBottom: "3px", fontSize: "9px" }}>
                    <strong>{note}:</strong>
                    <input type="text" value={customNotes[note] || ""} onChange={(e) => setCustomNotes((prev) => ({ ...prev, [note]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      style={{ marginLeft: "4px", border: "none", borderBottom: "1px solid #ccc", fontSize: "9px", width: "120px" }} />
                  </div>
                ))}
              </div>
              <div style={{ flex: "1", padding: "4px", borderLeft: "1px solid black" }}>
                {productionNotes.slice(2).map((note, index) => (
                  <div key={index} style={{ marginBottom: "3px", fontSize: "9px" }}>
                    <strong>{note}:</strong>
                    <input type="text" value={customNotes[note] || ""} onChange={(e) => setCustomNotes((prev) => ({ ...prev, [note]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      style={{ marginLeft: "4px", border: "none", borderBottom: "1px solid #ccc", fontSize: "9px", width: "120px" }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Crew Tables */}
          <div style={{ display: "flex", marginTop: "10px", flexWrap: "wrap", gap: "10px" }}>
            {(() => {
              const { leftTable, rightTable, leftUsed, rightUsed } = distributeCrewToTables();
              const availableCrew = getAvailableCrew();

              const renderCrewTable = (table, side, used, tableSize, setTableSize) => (
                <div style={{ flex: "1", minWidth: "300px" }}>
                  <div style={{ marginBottom: "5px", display: "flex", gap: "5px", alignItems: "center" }}>
                    <button onClick={() => setTableSize((prev) => prev + 1)} style={{ padding: "2px 6px", fontSize: "10px" }}>+ Row</button>
                    <button onClick={() => setTableSize((prev) => Math.max(1, prev - 1))} style={{ padding: "2px 6px", fontSize: "10px" }}>- Row</button>
                    <span style={{ fontSize: "10px" }}>({used}/{tableSize})</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f0f0f0" }}>
                        <th style={{ border: "1px solid black", padding: "4px", width: "25%" }}>POSITION</th>
                        <th style={{ border: "1px solid black", padding: "4px", width: "29%" }}>NAME</th>
                        <th style={{ border: "1px solid black", padding: "4px", width: "26%" }}>PHONE</th>
                        <th style={{ border: "1px solid black", padding: "4px", width: "20%" }}>IN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.map((item, index) => {
                        if (item.type === "header") {
                          return (
                            <tr key={`${side}-header-${item.department}`} style={{ backgroundColor: "#f0f0f0" }}>
                              <td colSpan={4} style={{ border: "1px solid black", padding: "4px", fontWeight: "bold", textAlign: "center" }}>{item.department.toUpperCase()}</td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={`${side}-crew-${item.id}`}>
                            <td style={{ border: "1px solid black", padding: "4px" }}>{item.position}</td>
                            <td style={{ border: "1px solid black", padding: "4px" }}>
                              {item.displayName}
                              <button onClick={() => removeCrewMember(item.id)} style={{ marginLeft: "5px", padding: "1px 4px", fontSize: "8px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "2px" }}>×</button>
                            </td>
                            <td style={{ border: "1px solid black", padding: "4px", textAlign: "center" }}>{item.phone}</td>
                            <td style={{ border: "1px solid black", padding: "4px" }}>
                              <input type="text" value={callSheetData.crewCallTimes?.[item.id] || ""} onChange={(e) => updateCrewCallTime(item.id, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                                style={{ width: "50px", border: "none", fontSize: "9px", textAlign: "center" }} />
                            </td>
                          </tr>
                        );
                      })}
                      {[...Array(Math.max(0, tableSize - used))].map((_, index) => (
                        <tr key={`${side}-empty-${index}`}>
                          <td style={{ border: "1px solid black", padding: "4px" }}></td>
                          <td style={{ border: "1px solid black", padding: "4px" }}>
                            <select onChange={(e) => { if (e.target.value) { addCrewMember(e.target.value); e.target.value = ""; } }} style={{ width: "100%", fontSize: "10px" }}>
                              <option value="">Select crew member...</option>
                              {availableCrew.map((person) => (
                                <option key={person.id} value={person.id}>{person.displayName || person.name} ({person.crewDepartment || person.department})</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ border: "1px solid black", padding: "4px" }}></td>
                          <td style={{ border: "1px solid black", padding: "4px" }}></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );

              return (
                <>
                  {renderCrewTable(leftTable, "left", leftUsed, leftTableSize, setLeftTableSize)}
                  {renderCrewTable(rightTable, "right", rightUsed, rightTableSize, setRightTableSize)}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Crew Removal Modal */}
      {removalModal && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={handleRemovalCancel} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #f44336", borderRadius: "8px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, minWidth: "400px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}>
              <span style={{ fontSize: "24px", marginRight: "10px" }}>⚠️</span>
              <h3 style={{ margin: 0 }}>Crew Member Still Booked</h3>
            </div>
            <p style={{ marginBottom: "20px" }}>
              <strong>{removalModal.person.displayName}</strong> is booked on this day.<br />Remove booking as well?
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={handleRemovalYes} style={{ backgroundColor: "#f44336", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Yes - Remove from CallSheet and Booking</button>
              <button onClick={handleRemovalNo} style={{ backgroundColor: "#FF9800", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>No - Remove from CallSheet Only</button>
              <button onClick={handleRemovalCancel} style={{ backgroundColor: "#ccc", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CallSheetModule;