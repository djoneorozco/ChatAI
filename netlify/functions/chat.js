// netlify/functions/chat.js

const fs   = require("fs").promises;
const path = require("path");
const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// In-memory rolling context per session
const contextCache = {};

/**
 * Load persona JSON for a given trust level and persona name
 */
async function loadPersona(level = 1, name = "odalys") {
  const fileName = `level-${level}.json`;
  const fullPath = path.join(__dirname, "personas", name, fileName);
  console.log("🔍 Loading persona JSON from:", fullPath);
  const raw = await fs.readFile(fullPath, "utf-8");
  const persona = JSON.parse(raw);
  return persona;
}

/**
 * Build the system prompt from persona JSON,
 * explicitly calling out the current job field.
 */
function buildSystemPrompt(p) {
  return `
You are ${p.name}, ${p.archetypeTagline}.

Your current job is: ${p.professionalBackground.job}.

${p.greeting}

${p.gptIntegration.contextInstruction}
`;
}

/**
 * Query OpenAI via the official SDK
 */
async function getOpenAIReply(systemPrompt, memory, userMessage) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system",  content: systemPrompt },
    ...memory,
    { role: "user",    content: userMessage }
  ];
  console.log("📝 Prompt roles sequence:", messages.map(m => m.role));
  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages
  });
  return res.choices[0].message.content.trim();
}

// Lambda entrypoint
exports.handler = async (event) => {
  console.log("⚙️ chat.js loaded");
  try {
    const body = JSON.parse(event.body || "{}");
    const userMessage = (body.message || "").trim();
    const sessionId   = event.headers["x-session-id"] || "default";

    console.log(`📨 New request: sessionId="${sessionId}", userMessage="${userMessage}"`);
    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message provided." }) };
    }

    // 1) Determine trust level & load persona JSON
    const trustLevel = getTrustLevel(sessionId);
    console.log("🔑 trustLevel =", trustLevel);
    const persona = await loadPersona(trustLevel, "odalys");
    console.log("📥 Loaded persona object:", persona);

    // 2) Build system prompt
    const systemPrompt = buildSystemPrompt(persona);
    console.log("📝 systemPrompt built");

    // 3) Rolling memory
    const mem     = (contextCache[sessionId] = contextCache[sessionId] || []);
    const history = mem.slice(-6);

    // 4) Query the model
    const reply = await getOpenAIReply(systemPrompt, history, userMessage);
    console.log("✅ OpenAI reply received");

    // 5) Update memory & trust
    mem.push({ role: "user",      content: userMessage });
    mem.push({ role: "assistant", content: reply       });
    addTrustPoints(sessionId, userMessage);

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel })
    };

  } catch (err) {
    console.error("❌ chat.js error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chat handler crashed", details: err.message })
    };
  }
};
