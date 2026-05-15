import React, { useMemo } from "react";

const PAGE_WIDTH_IN = 8.5;
const PAGE_HEIGHT_IN = 11;

const PAGE_MARGIN_TOP_IN = 1;
const PAGE_MARGIN_BOTTOM_IN = 1;
const PAGE_MARGIN_LEFT_IN = 1.5;
const PAGE_MARGIN_RIGHT_IN = 1;

const LINE_HEIGHT_PT = 12;
const CONTENT_HEIGHT_PT = (PAGE_HEIGHT_IN - PAGE_MARGIN_TOP_IN - PAGE_MARGIN_BOTTOM_IN) * 72;
const LINES_PER_PAGE = Math.floor(CONTENT_HEIGHT_PT / LINE_HEIGHT_PT);

const TYPE_LAYOUT = {
  "Scene Heading": {
    marginBeforeLines: 1,
    marginAfterLines: 1,
    leftIn: 0,
    widthIn: 6,
    textTransform: "uppercase",
    textAlign: "left",
  },
  Action: {
    marginBeforeLines: 0,
    marginAfterLines: 1,
    leftIn: 0,
    widthIn: 6,
    textTransform: "none",
    textAlign: "left",
  },
  Character: {
    marginBeforeLines: 1,
    marginAfterLines: 0,
    leftIn: 2.62,
    widthIn: 2.35,
    textTransform: "uppercase",
    textAlign: "left",
  },
  Parenthetical: {
    marginBeforeLines: 0,
    marginAfterLines: 0,
    leftIn: 2.28,
    widthIn: 2.35,
    textTransform: "none",
    textAlign: "left",
  },
  Dialogue: {
    marginBeforeLines: 0,
    marginAfterLines: 1,
    leftIn: 1.35,
    widthIn: 3.65,
    textTransform: "none",
    textAlign: "left",
  },
  Transition: {
    marginBeforeLines: 1,
    marginAfterLines: 1,
    leftIn: 4.6,
    widthIn: 1.4,
    textTransform: "uppercase",
    textAlign: "right",
  },
  Shot: {
    marginBeforeLines: 1,
    marginAfterLines: 1,
    leftIn: 0,
    widthIn: 6,
    textTransform: "uppercase",
    textAlign: "left",
  },
};

const CHARS_PER_LINE_BY_TYPE = {
  "Scene Heading": 60,
  Action: 60,
  Character: 22,
  Parenthetical: 24,
  Dialogue: 36,
  Transition: 18,
  Shot: 60,
};

const normalizeType = (type) => {
  return TYPE_LAYOUT[type] ? type : "Action";
};

const stripInlineSceneNumber = (text) => {
  return String(text || "").replace(/\s*#\d+#\s*$/g, "").trimEnd();
};

const getDisplayText = (node) => {
  const type = normalizeType(node?.type);
  const rawText = String(node?.text || "");

  if (type === "Scene Heading") {
    return stripInlineSceneNumber(rawText);
  }

  return rawText;
};

const getWrappedLineCount = (text, maxChars) => {
  const source = String(text || "").replace(/\u00a0/g, " ");
  const paragraphs = source.split(/\n+/);

  let total = 0;

  paragraphs.forEach((paragraph) => {
    const trimmed = paragraph.trimEnd();

    if (!trimmed) {
      total += 1;
      return;
    }

    const words = trimmed.split(/\s+/);
    let currentLineLength = 0;
    let lines = 1;

    words.forEach((word) => {
      const wordLength = word.length;

      if (currentLineLength === 0) {
        currentLineLength = wordLength;
        return;
      }

      if (currentLineLength + 1 + wordLength <= maxChars) {
        currentLineLength += 1 + wordLength;
      } else {
        lines += 1;
        currentLineLength = wordLength;
      }
    });

    total += Math.max(1, lines);
  });

  return Math.max(1, total);
};

const getNodeLineMetrics = (node, previousNode, nextNode) => {
  const type = normalizeType(node?.type);
  const layout = TYPE_LAYOUT[type] || TYPE_LAYOUT.Action;
  const nextType = normalizeType(nextNode?.type);
  const previousType = normalizeType(previousNode?.type);

  let marginBeforeLines = layout.marginBeforeLines;
  let marginAfterLines = layout.marginAfterLines;

  if (!previousNode) {
    marginBeforeLines = 0;
  }

  if (type === "Dialogue" && nextType === "Parenthetical") {
    marginAfterLines = 0;
  }

  if (type === "Dialogue" && previousType === "Parenthetical") {
    marginBeforeLines = 0;
  }

  if (type === "Parenthetical") {
    marginBeforeLines = 0;
    marginAfterLines = 0;
  }

  if (type === "Character" && nextType === "Dialogue") {
    marginAfterLines = 0;
  }

  const text = getDisplayText(node);
  const textLineCount = getWrappedLineCount(text || " ", CHARS_PER_LINE_BY_TYPE[type] || 60);

  return {
    type,
    layout,
    text,
    marginBeforeLines,
    marginAfterLines,
    textLineCount,
    totalLines: marginBeforeLines + textLineCount + marginAfterLines,
  };
};

const paginateNodes = (nodes = []) => {
  const pages = [];
  let currentPage = [];
  let cursorLine = 0;
  let sceneCounter = 0;

  const pushPage = () => {
    pages.push(currentPage);
    currentPage = [];
    cursorLine = 0;
  };

  nodes.forEach((node, index) => {
    const previousNode = nodes[index - 1] || null;
    const nextNode = nodes[index + 1] || null;
    const metrics = getNodeLineMetrics(node, previousNode, nextNode);

    if (metrics.type === "Scene Heading") {
      sceneCounter += 1;
    }

    const needsNewPage =
      currentPage.length > 0 &&
      cursorLine + metrics.totalLines > LINES_PER_PAGE;

    if (needsNewPage) {
      pushPage();
    }

    const topLine = cursorLine + metrics.marginBeforeLines;

    currentPage.push({
      node,
      metrics,
      topLine,
      sceneNumber: metrics.type === "Scene Heading" ? sceneCounter : null,
    });

    cursorLine += metrics.totalLines;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
};

export default function ScreenplayPagePreview({
  nodes = [],
  showSceneNumbers = true,
  titlePage = null,
}) {
  const pages = useMemo(() => paginateNodes(nodes), [nodes]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        alignItems: "center",
        padding: "24px",
        backgroundColor: "#f3f5f7",
      }}
    >
      {titlePage && (
        <div
          style={{
            width: `${PAGE_WIDTH_IN}in`,
            height: `${PAGE_HEIGHT_IN}in`,
            backgroundColor: "white",
            boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
            position: "relative",
            boxSizing: "border-box",
            fontFamily: "'Courier Prime', Courier, 'Courier New', monospace",
            fontSize: "12pt",
            lineHeight: `${LINE_HEIGHT_PT}pt`,
            color: "#000",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "3.5in",
              left: "1.5in",
              right: "1.5in",
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            {titlePage.title || ""}
          </div>

          <div
            style={{
              position: "absolute",
              top: "4.15in",
              left: "1.5in",
              right: "1.5in",
              textAlign: "center",
            }}
          >
            {titlePage.byline || "Written by"}
          </div>

          <div
            style={{
              position: "absolute",
              top: "4.55in",
              left: "1.5in",
              right: "1.5in",
              textAlign: "center",
            }}
          >
            {titlePage.author || ""}
          </div>
        </div>
      )}

      {pages.map((pageBlocks, pageIndex) => (
        <div
          key={`page-${pageIndex}`}
          style={{
            width: `${PAGE_WIDTH_IN}in`,
            height: `${PAGE_HEIGHT_IN}in`,
            backgroundColor: "white",
            boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
            position: "relative",
            boxSizing: "border-box",
            fontFamily: "'Courier Prime', Courier, 'Courier New', monospace",
            fontSize: "12pt",
            lineHeight: `${LINE_HEIGHT_PT}pt`,
            color: "#000",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: `${PAGE_MARGIN_TOP_IN}in`,
              left: `${PAGE_MARGIN_LEFT_IN}in`,
              width: `${PAGE_WIDTH_IN - PAGE_MARGIN_LEFT_IN - PAGE_MARGIN_RIGHT_IN}in`,
              height: `${PAGE_HEIGHT_IN - PAGE_MARGIN_TOP_IN - PAGE_MARGIN_BOTTOM_IN}in`,
            }}
          >
            {pageBlocks.map((block) => {
              const { node, metrics, topLine, sceneNumber } = block;
              const { type, layout, text } = metrics;

              return (
                <React.Fragment key={node.id}>
                  {showSceneNumbers && sceneNumber && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          top: `${topLine * LINE_HEIGHT_PT}pt`,
                          left: "-0.85in",
                          width: "0.5in",
                          textAlign: "left",
                        }}
                      >
                        {sceneNumber}
                      </div>

                      <div
                        style={{
                          position: "absolute",
                          top: `${topLine * LINE_HEIGHT_PT}pt`,
                          right: "-0.85in",
                          width: "0.5in",
                          textAlign: "right",
                        }}
                      >
                        {sceneNumber}
                      </div>
                    </>
                  )}

                  <div
                    style={{
                      position: "absolute",
                      top: `${topLine * LINE_HEIGHT_PT}pt`,
                      left: `${layout.leftIn}in`,
                      width: `${layout.widthIn}in`,
                      minHeight: `${metrics.textLineCount * LINE_HEIGHT_PT}pt`,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "break-word",
                      textTransform: layout.textTransform,
                      textAlign: layout.textAlign,
                    }}
                  >
                    {text || "\u00a0"}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <div
            style={{
              position: "absolute",
              bottom: "0.45in",
              left: 0,
              right: 0,
              textAlign: "center",
              color: "#9aa1b5",
            }}
          >
            {pageIndex + 1}.
          </div>
        </div>
      ))}
    </div>
  );
}