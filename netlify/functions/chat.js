// netlify/functions/chat.js

const fs = require("fs").promises;
const path = require("path");
const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// In-memory conversation memory per session
const contextCache = {};

// Load persona JSON based on trust level
async function loadPersona(level, name = "odalys") {
  const fileName = `level-${level}.json`;
  const fullPath = path.join(__dirname, "personas", name, fileName);
  console.log("🔍 loadPersona:", fullPath);
  const raw = await fs.readFile(fullPath, "utf-8");
  return JSON.parse(raw);
}

// Build a concise system prompt from the persona
function buildSystemPrompt(p) {
  return (
    `You are ${p.name}, ${p.archetypeTagline}.
Your current job is: ${p.professionalBackground.job}.
${p.greeting}
${p.gptIntegration.contextInstruction}`
  ).trim();
}

// Call OpenAI to get a chat reply
async function getOpenAIReply(systemPrompt, history, userMessage) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage }
  ];
  console.log("📡 OpenAI call roles:", messages.map(m => m.role));
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    temperature: 0.7,
    messages
  });
  return res.choices[0].message.content.trim();
}

// Netlify function handler
exports.handler = async (event) => {
  console.log("⚙️ chat.js invoked");

  // --- Health check: list persona JSON files ---
  if (event.queryStringParameters?.health) {
    const personaDir = path.join(__dirname, "personas", "odalys");
    try {
      const files = await fs.readdir(personaDir);
      return {
        statusCode: 200,
        body: JSON.stringify({ personaDir, files })
      };
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Health check failed", details: err.message })
      };
    }
  }

  // --- Parse request body ---
  let userMessage = "";
  try {
    const data = JSON.parse(event.body || "{}");
    userMessage = (data.message || "").trim();
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  if (!userMessage) {
    return { statusCode: 400, body: JSON.stringify({ error: "No message provided" }) };
  }
  const sessionId = event.headers["x-session-id"] || "default";
  console.log("📨 request", { sessionId, userMessage });

  try {
    // --- Determine trust level and load persona ---
    const trustLevel = getTrustLevel(sessionId);
    const persona = await loadPersona(trustLevel);
    console.log("📥 persona.job:", persona.professionalBackground.job);

    // --- Build prompt ---
    const systemPrompt = buildSystemPrompt(persona);
    console.log("📝 systemPrompt:\n", systemPrompt);

    // --- Manage memory ---
    const mem = contextCache[sessionId] = contextCache[sessionId] || [];
    const history = mem.slice(-6);

    // --- Query OpenAI ---
    const reply = await getOpenAIReply(systemPrompt, history, userMessage);
    console.log("✅ OpenAI reply:", reply);

    // --- Update memory & trust ---
    mem.push({ role: "user", content: userMessage });
    mem.push({ role: "assistant", content: reply });
    addTrustPoints(sessionId, userMessage);

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel })
    };

  } catch (err) {
    console.error("💥 Handler error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error", details: err.message })
    };
  }
};

