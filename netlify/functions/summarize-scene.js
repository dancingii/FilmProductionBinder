exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { heading, content } = JSON.parse(event.body);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        messages: [
          {
            role: "user",
            content: `Summarize this screenplay scene in one concise sentence of 15 words or fewer. Be specific about what happens. Do not start with "In this scene". Scene: ${heading}\n\n${content}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const summary = data.content?.[0]?.text?.trim() || "";

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ summary }),
    };
  } catch (err) {
    console.error("Summarize function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
