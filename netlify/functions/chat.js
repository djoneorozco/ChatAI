// netlify/functions/chat.js

const fs        = require("fs").promises;
const path      = require("path");
const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// In-memory rolling context
const contextCache = {};

// Constants
const PERSONA_NAME = "odalys";
const PERSONA_DIR  = path.join(__dirname, "personas", PERSONA_NAME);

/**
 * Netlify handler entrypoint
 */
exports.handler = async (event) => {
  console.info("⚙️  chat.js loaded");
  console.info("📂  cwd:", process.cwd());
  console.info("📂  __dirname:", __dirname);

  // --- 1) Health-check ---
  if (event.httpMethod === "GET") {
    return { statusCode: 200, body: "OK" };
  }

  // --- 2) Only POST allowed beyond this point ---
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // --- 3) Parse the JSON body ---
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    console.error("❌ Invalid JSON:", err);
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const userMessage = (body.message || "").trim();
  if (!userMessage) {
    return { statusCode: 400, body: JSON.stringify({ error: "No message provided" }) };
  }

  // --- 4) Derive session ID ---
  const sessionId = event.headers["x-session-id"] || "default";
  console.info("📩 New request:", sessionId, `"${userMessage}"`);

  try {
    // --- 5) Trust level determination ---
    const trustLevel = getTrustLevel(sessionId);
    console.info("🔒 trustLevel =", trustLevel);

    // --- 6) Load persona JSON for this level ---
    const personaFile = path.join(PERSONA_DIR, `level-${trustLevel}.json`);
    console.info("📖 Loading persona from:", personaFile);
    const raw    = await fs.readFile(personaFile, "utf-8");
    const persona = JSON.parse(raw);
    console.info("✅ Persona loaded:", persona.name, "level", persona.level);

    // --- 7) Build the system prompt ---
    const systemPrompt = buildSystemPrompt(persona);
    console.info("📝 systemPrompt length =", systemPrompt.length);

    // --- 8) Rolling memory (last 6 msgs) ---
    const history = (contextCache[sessionId] = contextCache[sessionId] || []);
    const memory  = history.slice(-6);
    console.info("🗂 history length →", memory.length);

    // --- 9) Query OpenAI ---
    const reply = await getOpenAIReply(systemPrompt, memory, userMessage);
    console.info("✅ OpenAI reply received");

    // --- 10) Update memory & trust →
    history.push({ role: "user",      content: userMessage });
    history.push({ role: "assistant", content: reply       });
    addTrustPoints(sessionId, userMessage);
    const newTrust = getTrustLevel(sessionId);
    console.info("🔼 addTrustPoints → new trustLevel =", newTrust);

    // --- 11) Return JSON response ---
    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel: newTrust })
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
 * Constructs the system prompt from your persona JSON
 */
function buildSystemPrompt(p) {
  const {
    name,
    archetypeTagline,
    mbti,
    zodiac,
    level,
    psychologicalProfile,
    lifestyleDetails,
    gptIntegration
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
 * Sends a chat completion request to OpenAI
 */
async function getOpenAIReply(systemPrompt, memory, userMessage) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system",  content: systemPrompt },
    ...memory,
    { role: "user",    content: userMessage }
  ];

  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages
  });

  return res.choices?.[0]?.message?.content.trim() || "(empty)";
}
