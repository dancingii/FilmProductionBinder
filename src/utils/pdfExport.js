import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Initialize fonts - correct syntax for CodeSandbox
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;

export class PDFExporter {
  // Standard document configuration
  static getBaseDocDef(orientation = "portrait") {
    return {
      pageSize: "LETTER",
      pageMargins: [25, 25, 25, 25],
      pageOrientation: orientation,
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          alignment: "center",
          margin: [0, 0, 0, 10],
        },
        subheader: {
          fontSize: 12,
          bold: true,
          margin: [0, 10, 0, 5],
        },
        tableHeader: {
          fontSize: 7,
          bold: true,
          fillColor: "#f0f0f0",
          alignment: "center",
        },
        tableCell: {
          fontSize: 7,
        },
        small: {
          fontSize: 10,
        },
        footer: {
          fontSize: 8,
          color: "#666666",
        },
      },
    };
  }

  // Standard project header (blue bar with title)
  static createProjectHeader(title, subtitle, projectName) {
    return {
      table: {
        widths: ["*"],
        body: [
          [
            {
              text: title,
              fontSize: 18,
              bold: true,
              color: "white",
              fillColor: "#2196F3",
              alignment: "center",
              margin: [5, 5, 5, 5],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 1.5,
        vLineWidth: () => 1,
      },
      margin: [0, 0, 0, 10],
    };
  }

  // Project info section
  static createProjectInfo(projectName, shootingDay, location = null) {
    const infoStack = [
      { text: `Project: ${projectName}`, fontSize: 12, margin: [0, 0, 0, 5] },
      { text: shootingDay, fontSize: 12, margin: [0, 0, 0, 5] },
    ];

    if (location) {
      infoStack.push({
        text: `Location: ${location}`,
        fontSize: 12,
        margin: [0, 0, 0, 5],
      });
    }

    return {
      stack: infoStack,
      margin: [0, 0, 0, 15],
    };
  }

  // Scene header (light blue background)
  static createSceneHeader(sceneNumber, sceneHeading) {
    return {
      table: {
        widths: ["*"],
        body: [
          [
            {
              text: `Scene ${sceneNumber}: ${sceneHeading}`,
              fontSize: 11,
              bold: true,
              fillColor: "#f0f8ff",
              margin: [5, 3, 5, 3],
            },
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 5, 0, 10],
    };
  }

  // Simple table helper
  static createTable(headers, rows, widths = null, options = {}) {
    return {
      table: {
        headerRows: 1,
        widths: widths || headers.map(() => "*"),
        body: [
          headers.map((h) => ({
            text: h,
            fontSize: 10,
            bold: true,
            fillColor: "#f0f0f0",
            alignment: "left",
            margin: [3, 3, 3, 3],
          })),
          ...rows.map((row) =>
            row.map((cell) => ({
              text: cell || "",
              fontSize: 10,
              margin: [3, 3, 3, 3],
            }))
          ),
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
      margin: options.margin || [0, 0, 0, 10],
    };
  }

  // Standard footer function
  static createFooterFunction(projectName) {
    return (currentPage, pageCount) => {
      return {
        text: `Generated: ${new Date().toLocaleDateString()} | Page ${currentPage} of ${pageCount}`,
        fontSize: 8,
        color: "#808080",
        alignment: "left",
        margin: [25, 10, 25, 0],
      };
    };
  }

  // Export/download function
  static download(docDefinition, filename) {
    pdfMake.createPdf(docDefinition).download(filename);
  }
}
