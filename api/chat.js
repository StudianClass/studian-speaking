export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    // body가 문자열/객체/빈 값 어떤 형태로 와도 안전하게 파싱
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body || typeof body !== "object") body = {};

    const { messages, system } = body;
    const key = (process.env.ANTHROPIC_API_KEY || "").trim();

    if (!key) return res.status(500).json({ error: "no key", hasKey: false });
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "bad messages", got: typeof messages });
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages,
      }),
    });

    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
