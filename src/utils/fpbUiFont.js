// Loads the correct CenturyGothic network font and registers it as 'FPB Century Gothic'
// for app-wide UI chrome. Call once at app startup. Safe to call multiple times.

const ALIAS = "FPB Century Gothic";
const GF_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Century+Gothic:wght@400;700&display=swap";

let _started = false;

export function loadFpbUiFont() {
  if (_started) return;
  _started = true;
  _run().catch(() => {});
}

async function _run() {
  const res = await fetch(GF_CSS_URL);
  if (!res.ok) return;
  const css = await res.text();

  // Parse each @font-face block — one per weight (skip duplicate weights)
  const blocks = css.split("@font-face").slice(1);
  const seen = new Set();
  const loads = [];

  for (const block of blocks) {
    const urlM = block.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/);
    const wgtM = block.match(/font-weight:\s*(\d+)/);
    if (!urlM) continue;
    const weight = wgtM ? wgtM[1] : "400";
    if (seen.has(weight)) continue;
    seen.add(weight);
    loads.push(
      new FontFace(ALIAS, `url(${urlM[1]})`, { weight })
        .load()
        .then((ff) => document.fonts.add(ff))
        .catch(() => {})
    );
  }

  await Promise.allSettled(loads);
}
