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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "X-Requested-With": "XMLHttpRequest",
        "X-Pinterest-AppState": "active",
        "Referer": "https://www.pinterest.com/",
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
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function parseBoardPath(boardUrl) {
  try {
    const u = new URL(boardUrl);
    // Expected: /username/boardname/ or /username/boardname
    const parts = u.pathname.replace(/^\/|\/$/g, "").split("/");
    if (parts.length < 2) return null;
    return { username: parts[0], slug: parts[1] };
  } catch { return null; }
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

  const board = parseBoardPath(boardUrl);
  if (!board) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Could not parse board URL. Expected format: pinterest.com/username/boardname/" }) };
  }

  try {
    // Step 1: Get board info to find the board ID
    const boardApiUrl = `https://www.pinterest.com/resource/BoardResource/get/?source_url=/${board.username}/${board.slug}/&data={"options":{"username":"${board.username}","slug":"${board.slug}"},"context":{}}&_=1`;

    const boardRes = await fetchUrl(boardApiUrl);
    let boardId = null;

    try {
      const boardData = JSON.parse(boardRes.body);
      boardId = boardData?.resource_response?.data?.id;
    } catch {}

    // Step 2: Fetch board feed using the internal resource API
    // Try with board ID if we got it, otherwise use username/slug
    const feedOptions = boardId
      ? `{"options":{"board_id":"${boardId}","page_size":50},"context":{}}`
      : `{"options":{"board_url":"/${board.username}/${board.slug}/","page_size":50},"context":{}}`;

    const feedUrl = `https://www.pinterest.com/resource/BoardFeedResource/get/?source_url=/${board.username}/${board.slug}/&data=${encodeURIComponent(feedOptions)}&_=1`;

    const feedRes = await fetchUrl(feedUrl);

    let pins = [];
    try {
      const feedData = JSON.parse(feedRes.body);
      const items = feedData?.resource_response?.data || [];
      pins = items
        .filter((pin) => pin?.images)
        .map((pin) => {
          // Pinterest returns multiple sizes — prefer 736x, fall back to others
          const img =
            pin.images["736x"] ||
            pin.images["orig"] ||
            pin.images["474x"] ||
            pin.images["236x"] ||
            Object.values(pin.images)[0];
          return img ? {
            url: img.url,
            width: img.width || 736,
            height: img.height || 552,
            title: pin.title || pin.description || "Pinterest Pin",
          } : null;
        })
        .filter(Boolean)
        .slice(0, 50);
    } catch (e) {
      console.log("Feed parse error:", e.message);
      console.log("Feed response status:", feedRes.status);
      console.log("Feed body preview:", feedRes.body?.slice(0, 500));
    }

    if (pins.length === 0) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          images: [],
          error: "No images returned. Pinterest may have blocked this request or the board is private. Try again in a moment.",
          debug: { boardId, feedStatus: feedRes.status },
        }),
      };
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ images: pins, count: pins.length }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: "Fetch failed: " + err.message }),
    };
  }
};