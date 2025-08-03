// netlify/functions/chat.js

const fs       = require("fs").promises;
const path     = require("path");
const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// In‐memory context: { [sessionId]: [ {role,content}, … ] }
const contextCache = {};

const PERSONA_NAME = "odalys";
const PERSONA_DIR  = path.join(__dirname, "personas", PERSONA_NAME);

/**
 * Health‐check and chat entrypoint
 */
exports.handler = async (event) => {
  console.info("⚙️ chat.js loaded");
  console.info("📂 process.cwd() =", process.cwd());
  console.info("📂 __dirname    =", __dirname);

  // GET → health check
  if (event.httpMethod === "GET") {
    return { statusCode: 200, body: "OK" };
  }

  // Only POST beyond here
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const userMessage = (body.message || "").trim();
    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message provided" }) };
    }

    // derive a session ID (you can swap this for a real user token)
    const sessionId = event.headers["x-session-id"] || "default";
    console.info("📩 New request:", sessionId, `"${userMessage}"`);

    // ---- 1) Trust level ----
    const trustLevel = getTrustLevel(sessionId);
    console.info("🔒 trustLevel =", trustLevel);

    // ---- 2) Load persona JSON for this trust level ----
    // Files are named level-1.json, level-2.json, etc
    const personaFile = path.join(PERSONA_DIR, `level-${trustLevel}.json`);
    console.info("📖 Loading persona JSON from:", personaFile);
    const personaRaw = await fs.readFile(personaFile, "utf-8");
    const persona    = JSON.parse(personaRaw);
    console.info("✅ Persona loaded:", persona.name, "level", persona.level);

    // ---- 3) Build system prompt ----
    const systemPrompt = buildSystemPrompt(persona);
    console.info("📝 systemPrompt length =", systemPrompt.length);

    // ---- 4) Rolling memory ----
    const history = contextCache[sessionId] = contextCache[sessionId] || [];
    const memory  = history.slice(-6); // last 6 messages
    console.info("🗂 history length →", memory.length);

    // ---- 5) Query OpenAI ----
    const reply = await getOpenAIReply(systemPrompt, memory, userMessage);
    console.info("✅ OpenAI reply received");

    // ---- 6) Push into memory + update trust ----
    history.push({ role: "user",    content: userMessage });
    history.push({ role: "assistant", content: reply       });
    addTrustPoints(sessionId, userMessage);
    console.info("🔼 addTrustPoints → new trustLevel =", getTrustLevel(sessionId));

    // ---- 7) Return ----
    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel: getTrustLevel(sessionId) })
    };

  } catch (err) {
    console.error("❌ chat.js error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error", details: err.message })
    };
  }
};

/**
 * Construct the system prompt from persona JSON
 */
function buildSystemPrompt(p) {
  // pick and choose whatever fields you need
  const {
    name, archetypeTagline, mbti, zodiac, level,
    psychologicalProfile, lifestyleDetails, gptIntegration
  } = p;

  const style = gptIntegration.personaStyle || "Reserved";
  const cap   = gptIntegration.replyCap       || 10;

  return `
You are ${name}, ${archetypeTagline} (${mbti}, ${zodiac}). Trust Level: ${level}

Summary: ${psychologicalProfile.personalitySummary}
Needs: ${psychologicalProfile.emotionalNeeds.join(", ")}
Triggers: ${psychologicalProfile.emotionalTriggers.join(", ")}

Hobbies: ${lifestyleDetails.hobbies.join(", ")}
Rules:
- Speak in a ${style.toLowerCase()} tone, max ${cap} words.
- Ask only short follow-ups (e.g. "You?", "Why?", "When?").
- No flirtation until trust grows.
`.trim();
}

/**
 * Send a chat completion request to OpenAI
 */
async function getOpenAIReply(system, memory, user) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system",  content: system },
    ...memory,
    { role: "user",    content: user   }
  ];

  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages
  });

  return res.choices?.[0]?.message?.content.trim() || "(empty response)";
}
