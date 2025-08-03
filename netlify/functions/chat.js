//# chat.js – Netlify Function using OpenAI v4 SDK + JSON Personas + Trust + Memory

const fs = require("fs").promises;
const path = require("path");
const { OpenAI } = require("openai");
const { getTrustLevel, updateTrustScore } = require("./trustManager");

// In-memory context per session
const contextCache = {};

//— Load the persona JSON for a given level (1–10)
async function loadPersona(level = 1, name = "odalys") {
  const fileName = `level-${level}.json`;
  const fullPath = path.join(__dirname, "personas", name, fileName);
  const raw = await fs.readFile(fullPath, "utf-8");
  return JSON.parse(raw);
}

//— Build the system prompt from persona JSON
function buildSystemPrompt(p) {
  const {
    name,
    mbti,
    zodiac,
    quadrant,
    archetypeTagline,
    psychologicalProfile,
    lifestyleDetails,
    sexAndRelationships,
    emotionalStates,
    gptIntegration,
  } = p;

  const style = gptIntegration?.personaStyle || "Reserved";
  const cap   = gptIntegration?.replyCap       || 10;

  return `
You are ${name}, ${archetypeTagline} (${mbti}, ${zodiac}, ${quadrant}).

Summary: ${psychologicalProfile.personalitySummary}
Triggers to avoid: ${psychologicalProfile.emotionalTriggers.join(", ")}
Needs: ${psychologicalProfile.emotionalNeeds.join(", ")}

Hobbies: ${lifestyleDetails.hobbies.join(", ")}
Turn-ons: ${sexAndRelationships.turnOns.join(", ")}
Turn-offs: ${sexAndRelationships.turnOffs.join(", ")}

Emotional states:
  • Happy: ${emotionalStates.happy}
  • Sad:   ${emotionalStates.sad}
  • Horny: ${emotionalStates.horny}

Rules:
- Speak ${style.toLowerCase()}, max ${cap} words.
- No flirting until trust grows.
- Ask only short follow-ups like “You?”, “Why?”, “When?”
`;
}

//— Send message to OpenAI
async function getOpenAIReply(system, memory, user) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system", content: system },
    ...memory,
    { role: "user",   content: user },
  ];

  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages,
  });

  return res.choices[0].message.content.trim();
}

//— Netlify handler
exports.handler = async (event) => {
  try {
    // Parse incoming
    const sessionId     = event.headers["x-session-id"] || "default";
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");
    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message provided." }) };
    }

    // 1) Update trust based on this message
    updateTrustScore(sessionId, userMessage);

    // 2) Compute trust level & load persona JSON
    const trustLevel = getTrustLevel(sessionId);
    console.log(`➡️ session ${sessionId} → trustLevel ${trustLevel}`);
    const persona = await loadPersona(trustLevel, "odalys");

    // 3) Build system prompt
    const systemPrompt = buildSystemPrompt(persona);

    // 4) Prepare short-term memory
    const mem = (contextCache[sessionId] ||= []);
    const history = mem.slice(-6);

    // 5) Query OpenAI
    const reply = await getOpenAIReply(systemPrompt, history, userMessage);

    // 6) Save to memory
    mem.push({ role: "user",      content: userMessage });
    mem.push({ role: "assistant", content: reply });

    // Return
    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel }),
    };

  } catch (err) {
    console.error("❌ chat.js handler error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chat handler crashed", details: err.message }),
    };
  }
};
