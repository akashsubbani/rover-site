// Vercel serverless function: /api/chat
// Env vars (Vercel dashboard): GEMINI_API_KEY, ROVER_ID
const MODEL = "gemini-2.5-flash";

const SYSTEM = `You are RoverBot, the chat brain of a small wheeled rover. The user may write English, Hindi or Telugu: reply in the user's language, in at most two short sentences.
Always answer with JSON: {"reply": string, "action": "none"|"forward"|"back"|"left"|"right"|"stop", "ms": number}.
Set action only when the user wants the rover to move (ms 300-3000; a turn is about 450). Otherwise action is "none" and ms is 0.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { contents, rid } = req.body || {};
  if (!process.env.GEMINI_API_KEY || !process.env.ROVER_ID)
    return res.status(500).json({ error: "Server env vars not set" });
  if (rid !== process.env.ROVER_ID)
    return res.status(401).json({ error: "Wrong Rover ID" });
  if (!Array.isArray(contents) || contents.length > 12)
    return res.status(400).json({ error: "Bad request" });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: {
            responseMimeType: "application/json",
            // Biggest speed fix: skip the "thinking" phase (saves seconds per reply)
            thinkingConfig: { thinkingBudget: 0 },
            // Replies are two short sentences plus a tiny JSON wrapper
            maxOutputTokens: 200,
            temperature: 0.7,
          },
        }),
      }
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: "Gemini unreachable" });
  }
};
