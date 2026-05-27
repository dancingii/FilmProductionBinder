import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../supabase";
import ScreenplayPagePreview from "./ScreenplayPagePreview";

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

const DEFAULT_PUBLIC_SHARE_WATERMARK = {
  enabled: true,
  text: "",
  opacity: 0.1,
  rotationDeg: -30,
  fontSizePx: 48,
  recipientNameEnabled: false,
  recipientName: "",
  brandingImageEnabled: false,
  brandingImageUrl: "",
  brandingImageSizePx: 120,
  brandingImageOpacity: 0.12,
};

const clampNumber = (value, min, max, fallback) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, numericValue));
};

const normalizeTitlePageSettings = (settings = {}) => ({
  ...DEFAULT_TITLE_PAGE_SETTINGS,
  ...(settings && typeof settings === "object" ? settings : {}),
  enabled: Boolean(settings?.enabled),
});

const normalizeWatermarkSettings = (settings = {}) => ({
  ...DEFAULT_PUBLIC_SHARE_WATERMARK,
  ...(settings && typeof settings === "object" ? settings : {}),
  enabled: settings?.enabled !== false,
  text: typeof settings?.text === "string" ? settings.text.slice(0, 120) : DEFAULT_PUBLIC_SHARE_WATERMARK.text,
  opacity: clampNumber(settings?.opacity, 0, 1, DEFAULT_PUBLIC_SHARE_WATERMARK.opacity),
  fontSizePx: Math.round(clampNumber(settings?.fontSizePx, 24, 96, DEFAULT_PUBLIC_SHARE_WATERMARK.fontSizePx)),
  rotationDeg: Math.round(clampNumber(settings?.rotationDeg, -60, 60, DEFAULT_PUBLIC_SHARE_WATERMARK.rotationDeg)),
  recipientNameEnabled: settings?.recipientNameEnabled === true,
  recipientName: typeof settings?.recipientName === "string" ? settings.recipientName.slice(0, 120) : "",
  brandingImageEnabled: settings?.brandingImageEnabled === true,
  brandingImageUrl: typeof settings?.brandingImageUrl === "string" ? settings.brandingImageUrl.slice(0, 2048) : "",
  brandingImageSizePx: Math.round(clampNumber(settings?.brandingImageSizePx, 40, 300, DEFAULT_PUBLIC_SHARE_WATERMARK.brandingImageSizePx)),
  brandingImageOpacity: clampNumber(settings?.brandingImageOpacity, 0, 1, DEFAULT_PUBLIC_SHARE_WATERMARK.brandingImageOpacity),
});

const escapeSvgText = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

const getWatermarkLines = (text) => {
  const source = String(text || "SHARED SCRIPT").slice(0, 240);
  const explicitLines = source.split(/\n+/).map(line => line.trim()).filter(Boolean);
  if (explicitLines.length > 1) return explicitLines;

  const maxLineChars = 34;
  if (source.length <= maxLineChars) return [source];

  const words = source.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLineChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : ["SHARED SCRIPT"];
};

const estimateWatermarkTile = (lines, config = DEFAULT_PUBLIC_SHARE_WATERMARK) => {
  const fontSize = config.fontSizePx;
  const letterSpacing = 6;
  const lineHeight = Math.round(fontSize * 1.18);
  const textWidth = Math.max(
    fontSize * 6,
    ...lines.map(line => (line.length * fontSize * 0.62) + Math.max(0, line.length - 1) * letterSpacing)
  );
  const textHeight = Math.max(lineHeight, lines.length * lineHeight);
  const angle = Math.abs((config.rotationDeg || 0) * Math.PI / 180);
  const rotatedWidth = (textWidth * Math.cos(angle)) + (textHeight * Math.sin(angle));
  const rotatedHeight = (textWidth * Math.sin(angle)) + (textHeight * Math.cos(angle));
  const padding = Math.max(80, fontSize * 1.6);

  return {
    width: Math.ceil(rotatedWidth + padding * 2),
    height: Math.ceil(rotatedHeight + padding * 2),
    lineHeight,
  };
};

const buildWatermarkDataUrl = (text, config = DEFAULT_PUBLIC_SHARE_WATERMARK) => {
  const lines = getWatermarkLines(text || config.text || "SHARED SCRIPT");
  const tile = estimateWatermarkTile(lines, config);
  const centerX = tile.width / 2;
  const centerY = tile.height / 2;
  const firstLineY = centerY - ((lines.length - 1) * tile.lineHeight / 2);
  const tspans = lines.map((line, index) => (
    `<tspan x="${centerX}" y="${firstLineY + index * tile.lineHeight}">${escapeSvgText(line)}</tspan>`
  )).join("");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${tile.width}" height="${tile.height}" viewBox="0 0 ${tile.width} ${tile.height}">
      <text
        text-anchor="middle"
        dominant-baseline="middle"
        transform="rotate(${config.rotationDeg} ${centerX} ${centerY})"
        fill="#6f7b85"
        fill-opacity="${config.opacity}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${config.fontSizePx}"
        font-weight="700"
        letter-spacing="6"
      >${tspans}</text>
    </svg>
  `;
  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    tileWidth: tile.width,
    tileHeight: tile.height,
  };
};

const getWatermarkText = (projectName = "", settings = DEFAULT_PUBLIC_SHARE_WATERMARK) => {
  const baseText = String(settings.text || "").trim() || String(projectName || "").trim() || "SHARED SCRIPT";
  const recipientName = settings.recipientNameEnabled ? String(settings.recipientName || "").trim() : "";
  return recipientName ? `${baseText} · ${recipientName}` : baseText;
};

function PublicScriptWatermark({ projectName = "", watermarkSettings = null }) {
  const settings = normalizeWatermarkSettings(watermarkSettings);
  if (!settings.enabled) return null;

  const watermarkText = getWatermarkText(projectName, settings);
  const watermarkTile = buildWatermarkDataUrl(watermarkText, settings);
  const showBrandingImage = settings.brandingImageEnabled && settings.brandingImageUrl.trim();
  const brandingTiles = showBrandingImage ? Array.from({ length: 60 }) : [];

  return (
    <>
      <style>{`
        @media (max-width: 720px) {
          .public-script-share-watermark {
            background-position: center top;
          }
        }
      `}</style>
      <div
        className="public-script-share-watermark"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 5,
          pointerEvents: "none",
          userSelect: "none",
          backgroundImage: watermarkTile.backgroundImage,
          backgroundRepeat: "repeat",
          backgroundSize: `${watermarkTile.tileWidth}px ${watermarkTile.tileHeight}px`,
          mixBlendMode: "multiply",
        }}
      />
      {showBrandingImage && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 6,
            pointerEvents: "none",
            userSelect: "none",
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${settings.brandingImageSizePx * 2}px, 1fr))`,
            gap: `${settings.brandingImageSizePx}px`,
            alignItems: "center",
            justifyItems: "center",
            padding: `${Math.round(settings.brandingImageSizePx / 2)}px`,
            boxSizing: "border-box",
            opacity: settings.brandingImageOpacity,
            mixBlendMode: "multiply",
          }}
        >
          {brandingTiles.map((_, index) => (
            <img
              key={index}
              src={settings.brandingImageUrl}
              alt=""
              draggable={false}
              onError={(event) => { event.currentTarget.style.display = "none"; }}
              style={{
                width: `${settings.brandingImageSizePx}px`,
                maxHeight: `${settings.brandingImageSizePx}px`,
                objectFit: "contain",
                transform: `rotate(${settings.rotationDeg}deg)`,
                filter: "grayscale(1)",
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function PublicTitlePage({ settings }) {
  const safeSettings = normalizeTitlePageSettings(settings);
  if (!safeSettings.enabled) return null;

  return (
    <div
      style={{
        width: "8.5in",
        height: "11in",
        backgroundColor: "white",
        boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
        position: "relative",
        boxSizing: "border-box",
        fontFamily: "'Courier Prime', Courier, 'Courier New', monospace",
        fontSize: "12pt",
        lineHeight: "12pt",
        color: "#000",
        flexShrink: 0,
      }}
    >
      <div style={{ position: "absolute", top: "3.05in", left: "1.2in", right: "1.2in", textAlign: "center", whiteSpace: "pre-wrap", textTransform: "uppercase" }}>
        {safeSettings.title}
      </div>
      <div style={{ position: "absolute", top: "3.82in", left: "1.2in", right: "1.2in", textAlign: "center", whiteSpace: "pre-wrap" }}>
        {safeSettings.creditLabel}
      </div>
      <div style={{ position: "absolute", top: "4.2in", left: "1.2in", right: "1.2in", textAlign: "center", whiteSpace: "pre-wrap" }}>
        {safeSettings.writerName}
      </div>
      <div style={{ position: "absolute", top: "5.12in", left: "1.2in", right: "1.2in", textAlign: "center", whiteSpace: "pre-wrap" }}>
        {safeSettings.revisionsLabel}
        {safeSettings.revisionsText ? `\n\n${safeSettings.revisionsText}` : ""}
      </div>
      <div style={{ position: "absolute", top: "6.55in", left: "1.2in", right: "1.2in", textAlign: "center", whiteSpace: "pre-wrap" }}>
        {safeSettings.currentRevisionsLabel}
        {safeSettings.currentRevisionsText ? `\n\n${safeSettings.currentRevisionsText}` : ""}
      </div>
      <div style={{ position: "absolute", left: "1.15in", bottom: "1.05in", whiteSpace: "pre-wrap" }}>
        {safeSettings.contactBlock}
      </div>
    </div>
  );
}

function ResponsivePublicScriptPages({ children, renderContent }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [layout, setLayout] = useState({ width: 0, height: 0, scale: 1 });

  useEffect(() => {
    const updateLayout = () => {
      const container = containerRef.current;
      const content = contentRef.current;
      if (!container || !content) return;

      const contentWidth = content.offsetWidth || content.scrollWidth || 0;
      const contentHeight = content.offsetHeight || content.scrollHeight || 0;
      if (!contentWidth || !contentHeight) return;

      const availableWidth = Math.max(1, container.clientWidth);
      const nextScale = Math.min(1, availableWidth / contentWidth);

      setLayout(prev => {
        const next = {
          width: contentWidth,
          height: contentHeight,
          scale: nextScale,
        };
        if (
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5 &&
          Math.abs(prev.scale - next.scale) < 0.001
        ) {
          return prev;
        }
        return next;
      });
    };

    updateLayout();

    const observers = [];
    if (typeof ResizeObserver !== "undefined") {
      const containerObserver = new ResizeObserver(updateLayout);
      const contentObserver = new ResizeObserver(updateLayout);
      if (containerRef.current) containerObserver.observe(containerRef.current);
      if (contentRef.current) contentObserver.observe(contentRef.current);
      observers.push(containerObserver, contentObserver);
    }

    window.addEventListener("resize", updateLayout);
    return () => {
      window.removeEventListener("resize", updateLayout);
      observers.forEach(observer => observer.disconnect());
    };
  }, [children]);

  const scaledWidth = layout.width * layout.scale;
  const scaledHeight = layout.height * layout.scale;
  const isScaled = layout.scale < 0.999;
  const content = typeof renderContent === "function" ? renderContent({ isScaled }) : children;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        overflowX: "hidden",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: scaledWidth || "100%",
          height: scaledHeight || "auto",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          ref={contentRef}
          style={{
            display: "inline-block",
            transform: layout.width ? `translateX(-50%) scale(${layout.scale})` : `scale(${layout.scale})`,
            transformOrigin: "top center",
            position: layout.width ? "absolute" : "relative",
            top: 0,
            left: layout.width ? "50%" : 0,
          }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

function getTokenFromPath() {
  const match = window.location.pathname.match(/^\/share\/script\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export default function PublicScriptShareViewer() {
  const [status, setStatus] = useState("loading");
  const [payload, setPayload] = useState(null);
  const token = useMemo(() => getTokenFromPath(), []);

  useEffect(() => {
    let cancelled = false;

    const loadSharedScript = async () => {
      if (!token) {
        setStatus("unavailable");
        return;
      }

      setStatus("loading");
      try {
        const { data, error } = await supabase.rpc("get_shared_script_by_token", {
          p_token: token,
        });
        if (error) throw error;
        if (cancelled) return;
        if (!data) {
          setPayload(null);
          setStatus("unavailable");
          return;
        }
        setPayload(data);
        setStatus("ready");
      } catch (error) {
        console.error("Could not load shared script:", error);
        if (!cancelled) setStatus("unavailable");
      }
    };

    loadSharedScript();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const nodes = Array.isArray(payload?.writingDraft?.nodes) ? payload.writingDraft.nodes : [];
  const titlePageSettings = normalizeTitlePageSettings(payload?.titlePageSettings);
  const watermarkSettings = payload?.watermarkSettings || null;

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f5f7", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", color: "#607D8B" }}>
        Loading shared script...
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f5f7", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", color: "#455A64", padding: "24px", boxSizing: "border-box" }}>
        <div style={{ maxWidth: "420px", padding: "28px", backgroundColor: "white", border: "1px solid #d7dde2", borderRadius: "8px", boxShadow: "0 4px 18px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <h1 style={{ margin: "0 0 10px", fontSize: "20px" }}>This script link is unavailable.</h1>
          <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5 }}>The link may have been revoked, expired, or entered incorrectly.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f5f7", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", position: "relative", overflowX: "hidden" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, padding: "12px 20px", backgroundColor: "white", borderBottom: "1px solid #d7dde2", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ maxWidth: "8.5in", margin: "0 auto", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#607D8B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Read-only shared script</div>
            <h1 style={{ margin: "2px 0 0", fontSize: "18px", color: "#263238" }}>{payload?.projectName || "Shared Script"}</h1>
          </div>
          {payload?.sharedAt && (
            <div style={{ fontSize: "11px", color: "#78909C", whiteSpace: "nowrap" }}>
              Shared {new Date(payload.sharedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </header>

      {nodes.length > 0 || titlePageSettings.enabled ? (
        <>
          <ResponsivePublicScriptPages
            renderContent={({ isScaled }) => (
              <div className={isScaled ? "public-script-share-scaled-content" : ""} style={{ position: "relative" }}>
                {isScaled && (
                  <style>{`
                    .public-script-share-scaled-content .public-script-share-preview-shell > div {
                      padding: 0 !important;
                      gap: 0 !important;
                      background-color: transparent !important;
                    }
                    .public-script-share-scaled-content [style*="box-shadow"] {
                      box-shadow: none !important;
                    }
                  `}</style>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: isScaled ? "0" : "24px", alignItems: "center", padding: isScaled ? "0" : "24px", boxSizing: "border-box", position: "relative", zIndex: 1 }}>
                  <PublicTitlePage settings={titlePageSettings} />
                  {nodes.length > 0 && (
                    <div className="public-script-share-preview-shell">
                      <ScreenplayPagePreview nodes={nodes} showSceneNumbers={false} titlePage={null} />
                    </div>
                  )}
                </div>
              </div>
            )}
          />
          <PublicScriptWatermark projectName={payload?.projectName || ""} watermarkSettings={watermarkSettings} />
        </>
      ) : (
        <div style={{ padding: "48px 24px", textAlign: "center", color: "#607D8B" }}>
          No script content is available.
        </div>
      )}
    </div>
  );
}
