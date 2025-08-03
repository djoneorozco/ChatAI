//# chat.js – Netlify Function using OpenAI v4 SDK, JSON Persona + Trust + Memory

const fs   = require("fs").promises;
const path = require("path");
const { OpenAI } = require("openai");
const {
  addTrustPoints,
  getTrustLevel
} = require("./trustManager");

// short‐term, per‐session rolling memory
const contextCache = {};

// — Load the correct JSON for a given level & persona
async function loadPersona(level = 1, name = "odalys") {
  const fileName = `level-${level}.json`;
  const fullPath = path.join(__dirname, "personas", name, fileName);
  const raw      = await fs.readFile(fullPath, "utf-8");
  return JSON.parse(raw);
}

// — Build the system prompt from the persona JSON
function buildSystemPrompt(p) {
  const {
    name,
    archetypeTagline,
    mbti,
    zodiac,
    quadrant,
    psychologicalProfile,
    lifestyleDetails,
    sexAndRelationships,
    emotionalStates,
    gptIntegration
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

Emotional States:
  • Happy: ${emotionalStates.happy}
  • Sad:   ${emotionalStates.sad}
  • Horny: ${emotionalStates.horny}

Rules:
- Speak ${style.toLowerCase()}, max ${cap} words.
- No flirting until trust grows.
- Ask only short follow-ups: "You?", "Why?", "When?"
`;
}

// — Ask OpenAI via v4 SDK
async function getOpenAIReply(system, memory, user) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const messages = [
    { role: "system",  content: system },
    ...memory,
    { role: "user",    content: user }
  ];

  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages
  });

  return res.choices[0].message.content.trim();
}

// — Lambda entrypoint
exports.handler = async (event) => {
  try {
    // 1️⃣ Parse input & session
    const sessionId    = event.headers["x-session-id"] || "default";
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");
    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message provided." }) };
    }

    // 2️⃣ Add trust points for this user message
    addTrustPoints(sessionId, userMessage);

    // 3️⃣ Determine current trust level (1–10) & load that persona
    const trustLevel = getTrustLevel(sessionId);
    const persona    = await loadPersona(trustLevel, "odalys");

    // 4️⃣ Build system prompt
    const systemPrompt = buildSystemPrompt(persona);

    // 5️⃣ Pull last 6 turns from memory
    const mem     = (contextCache[sessionId] ||= []);
    const history = mem.slice(-6);

    // 6️⃣ Get a reply from OpenAI
    const reply = await getOpenAIReply(systemPrompt, history, userMessage);

    // 7️⃣ Update in-memory chat history
    mem.push({ role: "user",      content: userMessage });
    mem.push({ role: "assistant", content: reply       });

    // 8️⃣ Return reply & updated trust level
    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel })
    };

  } catch (err) {
    console.error("Fatal chat.js error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chat handler crashed", details: err.message })
    };
  }
};
