// netlify/functions/chat.js

const fs   = require("fs").promises;
const path = require("path");
const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

const contextCache = {};

//––– DEBUG: on cold start, log where we are and what files we have –––
console.log("⚙️  chat.js loaded");
console.log("  process.cwd() =", process.cwd());
console.log("  __dirname        =", __dirname);

// Load persona JSON for a given trust level and persona name
async function loadPersona(level = 1, name = "odalys") {
  const personaDir = path.join(__dirname, "personas", name);
  console.log(`🔍 personaDir = ${personaDir}`);
  try {
    const files = await fs.readdir(personaDir);
    console.log("📂 files in personaDir:", files);
  } catch (err) {
    console.error("❌ readdir error on personaDir:", err);
  }

  const fileName = `level-${level}.json`;
  const fullPath = path.join(personaDir, fileName);
  console.log(`🔗 Attempting to read JSON at: ${fullPath}`);
  try {
    const raw = await fs.readFile(fullPath, "utf-8");
    console.log("✅ JSON read successful");
    return JSON.parse(raw);
  } catch (err) {
    console.error("❌ Failed to load persona JSON:", err);
    throw err;
  }
}

// Build the system prompt from persona JSON
function buildSystemPrompt(p) {
  console.log("📝 buildSystemPrompt using persona:", p.name, "level:", p.level);
  const {
    name,
    archetypeTagline,
    mbti,
    zodiac,
    quadrant,
    psychologicalProfile = {},
    lifestyleDetails = {},
    sexAndRelationships = {},
    emotionalStates = {},
    gptIntegration = {}
  } = p;

  const style = gptIntegration.personaStyle || "Reserved";
  const cap   = gptIntegration.replyCap       || 12;

  // If any of these arrays are missing, guard against errors
  const triggers = (psychologicalProfile.emotionalTriggers || []).join(", ");
  const needs    = (psychologicalProfile.emotionalNeeds    || []).join(", ");
  const hobbies  = (lifestyleDetails.hobbies || []).join(", ");
  const turnOns  = (sexAndRelationships.turnOns || []).join(", ");
  const turnOffs = (sexAndRelationships.turnOffs || []).join(", ");

  return `
You are ${name} — ${archetypeTagline}.
Type: ${mbti}, ${zodiac}, ${quadrant}.

Summary: ${psychologicalProfile.personalitySummary || "(none)"}
Triggers to avoid: ${triggers}
Needs: ${needs}

Hobbies: ${hobbies}
Turn-ons: ${turnOns}
Turn-offs: ${turnOffs}

Emotional States:
  • Happy: ${emotionalStates.happy}
  • Sad:   ${emotionalStates.sad}
  • Horny: ${emotionalStates.horny}

Rules:
- Speak ${style.toLowerCase()}, max ${cap} words per reply.
- No flirting until trust grows.
- Ask only short follow-ups ("You?", "Why?", "When?").
`.trim();
}

// Query OpenAI via v4 SDK
async function getOpenAIReply(system, memory, user) {
  console.log("🤖 getOpenAIReply() → system prompt length:", system.length);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const msgs = [
    { role: "system",  content: system },
    ...memory,
    { role: "user",    content: user    }
  ];
  console.log("   messages:", msgs.map(m=>m.role));

  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages:    msgs
  });
  console.log("✅ OpenAI response received");
  return res.choices[0].message.content.trim();
}

// Lambda entrypoint
exports.handler = async (event) => {
  try {
    console.log("📨 New request:", event.path);
    const sessionId = event.headers["x-session-id"] || "default";
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");
    console.log(`  sessionId="${sessionId}", userMessage="${userMessage}"`);

    if (!userMessage) {
      console.warn("⚠️  No user message in payload");
      return { statusCode: 400, body: JSON.stringify({ error: "No message." }) };
    }

    // 1) Trust level & persona
    const trustLevel = getTrustLevel(sessionId);
    console.log("  getTrustLevel →", trustLevel);
    const persona  = await loadPersona(trustLevel, "odalys");
    const system   = buildSystemPrompt(persona);

    // 2) Rolling memory
    const mem     = (contextCache[sessionId] = contextCache[sessionId] || []);
    const history = mem.slice(-6);
    console.log("  history length →", history.length);

    // 3) Query
    const reply = await getOpenAIReply(system, history, userMessage);

    // 4) Update memory & trust
    mem.push({ role: "user",      content: userMessage });
    mem.push({ role: "assistant", content: reply       });
    addTrustPoints(sessionId, userMessage);
    console.log("  addTrustPoints, new trustLevel →", getTrustLevel(sessionId));

    return { statusCode: 200, body: JSON.stringify({ reply, trustLevel }) };
  } catch (err) {
    console.error("💥 Fatal chat.js error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chat handler crashed", details: err.message })
    };
  }
};
