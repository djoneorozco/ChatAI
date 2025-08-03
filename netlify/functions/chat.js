// netlify/functions/chat.js

const fs        = require("fs").promises;
const path      = require("path");
const { OpenAI }= require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

const PERSONA_NAME = "odalys";
const PERSONA_DIR  = path.join(__dirname, "personas", PERSONA_NAME);

// In‐memory context: { [sessionId]: [ {role,content}, … ] }
const contextCache = {};

/**
 * Handler entrypoint
 */
exports.handler = async (event) => {
  console.info("⚙️  chat.js loaded");
  console.info("📂 cwd    =", process.cwd());
  console.info("📂 __dirname =", __dirname);

  // 1) Health check
  if (event.httpMethod === "GET") {
    return { statusCode: 200, body: "OK" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 2) Parse and validate body
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");
    if (!userMessage.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message provided" }) };
    }
    const sessionId = event.headers["x-session-id"] || "default";
    console.info(`📩 New request: session="${sessionId}" message="${userMessage}"`);

    // 3) Trust level
    const trustLevel = getTrustLevel(sessionId);
    console.info("🔒 trustLevel =", trustLevel);

    // 4) List persona files (debug)
    const files = await fs.readdir(PERSONA_DIR);
    console.info("💾 Persona files in", PERSONA_DIR, "→", files);

    // 5) Load correct level JSON
    const personaFile = path.join(PERSONA_DIR, `level-${trustLevel}.json`);
    console.info("📖 Loading persona JSON from:", personaFile);
    const raw = await fs.readFile(personaFile, "utf-8");
    const persona = JSON.parse(raw);
    console.info("✅ Persona loaded:", persona.name, "level", persona.level);

    // 6) Build system prompt
    const systemPrompt = buildSystemPrompt(persona);
    console.info("📝 systemPrompt length =", systemPrompt.length);

    // 7) Rolling memory
    const history = (contextCache[sessionId] ||= []);
    const memory  = history.slice(-6); 
    console.info("🗂 history length →", history.length);

    // 8) Query OpenAI
    const reply = await getOpenAIReply(systemPrompt, memory, userMessage);
    console.info("✅ OpenAI reply received");

    // 9) Update memory & trust
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: reply });
    addTrustPoints(sessionId, userMessage);
    console.info("🔼 trustLevel now →", getTrustLevel(sessionId));

    // 10) Return JSON
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
 * Build the system‐prompt from persona JSON
 */
function buildSystemPrompt(p) {
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
- Ask only short follow-ups: "You?", "Why?", "When?"
- No flirtation until trust grows.
`.trim();
}

/**
 * Send a chat completion to OpenAI
 */
async function getOpenAIReply(system, memory, user) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system", content: system },
    ...memory,
    { role: "user",   content: user   }
  ];
  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages
  });
  return res.choices?.[0]?.message?.content.trim() || "(empty response)";
}
