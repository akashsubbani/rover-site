// Vercel serverless function: /api/chat
// Env vars (Vercel dashboard): GEMINI_API_KEY, ROVER_ID
// Tries each model in order if one has been retired (404).
const MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3-flash-preview"];

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
    let last = { status: 502, data: { error: "No model available" } };
    for (const model of MODELS) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents,
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      const data = await r.json();
      if (r.status !== 404) return res.status(r.status).json(data);
      last = { status: 404, data };
    }
    res.status(last.status).json(last.data);
  } catch (e) {
    res.status(502).json({ error: "Gemini unreachable" });
  }
};
