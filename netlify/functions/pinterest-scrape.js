const https = require("https");

function fetchUrl(targetUrl, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("Too many redirects"));
    let parsed;
    try { parsed = new URL(targetUrl); } catch { return reject(new Error("Invalid URL")); }

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    };

    const req = https.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith("http")
          ? res.headers.location
          : `https://${parsed.hostname}${res.headers.location}`;
        return resolve(fetchUrl(next, redirectCount + 1));
      }
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Request timed out")); });
  });
}

function extractImages(html) {
  const seen = new Set();
  const images = [];

  // Pinterest serves images from i.pinimg.com — extract all unique ones
  // Normalize all sizes to 736x for consistent quality
  const re = /https?:\\?\/\\?\/i\.pinimg\.com\\?\/(?:originals|736x|564x|474x|236x)\\?\/([a-f0-9/\\]+\.(?:jpg|jpeg|png|webp|gif))/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const path = m[1].replace(/\\/g, "");
    const url = `https://i.pinimg.com/736x/${path}`;
    if (!seen.has(url)) {
      seen.add(url);
      images.push({ url, width: 736, height: 552 });
    }
    if (images.length >= 60) break;
  }

  // Fallback: look for pinimg URLs in a slightly different format
  if (images.length === 0) {
    const re2 = /"url"\s*:\s*"(https?:\\?\/\\?\/i\.pinimg\.com[^"]+)"/gi;
    while ((m = re2.exec(html)) !== null) {
      const url = m[1].replace(/\\/g, "");
      if (!seen.has(url)) {
        seen.add(url);
        images.push({ url, width: 736, height: 552 });
      }
      if (images.length >= 60) break;
    }
  }

  return images;
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  const boardUrl = event.queryStringParameters?.url;

  if (!boardUrl) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing url parameter" }) };
  }

  if (!/pinterest\.(com|co\.|fr|de|es|it|jp|pt|com\.au|co\.uk)/i.test(boardUrl)) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Not a Pinterest URL" }) };
  }

  try {
    const html = await fetchUrl(boardUrl);

    if (!html || html.length < 500) {
      return {
        statusCode: 200, headers: cors,
        body: JSON.stringify({ images: [], error: "Pinterest returned an empty or blocked page. The board may be private." }),
      };
    }

    const images = extractImages(html);

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ images, count: images.length }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: "Fetch failed: " + err.message }),
    };
  }
};