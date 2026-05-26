import React, { useEffect, useMemo, useState } from "react";
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

const buildWatermarkDataUrl = (text, config = DEFAULT_PUBLIC_SHARE_WATERMARK) => {
  const safeText = escapeSvgText(String(text || config.text || "SHARED SCRIPT").slice(0, 240));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="520" height="380" viewBox="0 0 520 380">
      <text
        x="260"
        y="190"
        text-anchor="middle"
        dominant-baseline="middle"
        transform="rotate(${config.rotationDeg} 260 190)"
        fill="#6f7b85"
        fill-opacity="${config.opacity}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${config.fontSizePx}"
        font-weight="700"
        letter-spacing="6"
      >${safeText}</text>
    </svg>
  `;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
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
  const showBrandingImage = settings.brandingImageEnabled && settings.brandingImageUrl.trim();
  const brandingTiles = showBrandingImage ? Array.from({ length: 60 }) : [];

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 5,
          pointerEvents: "none",
          userSelect: "none",
          backgroundImage: buildWatermarkDataUrl(watermarkText, settings),
          backgroundRepeat: "repeat",
          backgroundSize: "520px 380px",
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f5f7", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", color: "#607D8B" }}>
        Loading shared script...
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f5f7", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", color: "#455A64", padding: "24px", boxSizing: "border-box" }}>
        <div style={{ maxWidth: "420px", padding: "28px", backgroundColor: "white", border: "1px solid #d7dde2", borderRadius: "8px", boxShadow: "0 4px 18px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <h1 style={{ margin: "0 0 10px", fontSize: "20px" }}>This script link is unavailable.</h1>
          <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5 }}>The link may have been revoked, expired, or entered incorrectly.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f5f7", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif" }}>
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
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", alignItems: "center", padding: "24px", boxSizing: "border-box", position: "relative", zIndex: 1 }}>
            <PublicTitlePage settings={titlePageSettings} />
            {nodes.length > 0 && (
              <ScreenplayPagePreview nodes={nodes} showSceneNumbers={false} titlePage={null} />
            )}
          </div>
          <PublicScriptWatermark projectName={payload?.projectName || ""} watermarkSettings={watermarkSettings} />
        </div>
      ) : (
        <div style={{ padding: "48px 24px", textAlign: "center", color: "#607D8B" }}>
          No script content is available.
        </div>
      )}
    </div>
  );
}
