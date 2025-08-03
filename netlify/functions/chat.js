// chat.js – Netlify Function with JSON Persona + Trust + Memory

const fs        = require("fs").promises;
const path      = require("path");
const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// In-memory rolling context per session
const contextCache = {};

/** Load persona JSON for a given trust level */
async function loadPersona(level = 1, name = "odalys") {
  const file = `level-${level}.json`;
  const full = path.join(__dirname, "personas", name, file);
  console.log("🔍 loading persona from:", full);
  try {
    const raw = await fs.readFile(full, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("❌ failed to load persona JSON:", full, err.message);
    throw err;
  }
}

/** Build the system prompt from persona JSON */
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

  const style = (gptIntegration && gptIntegration.personaStyle) || "Reserved";
  const cap   = (gptIntegration && gptIntegration.replyCap) || 10;

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
- Ask only short follow-ups like “You?”, “Why?”, “When?”
`;
}

/** Query OpenAI via v4 SDK */
async function getOpenAIReply(system, memory, user) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system", content: system },
    ...memory,
    { role: "user", content: user }
  ];

  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages
  });

  return res.choices[0].message.content.trim();
}

// Netlify Lambda entrypoint
exports.handler = async (event) => {
  try {
    const sessionId = event.headers["x-session-id"] || "default";
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");
    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message." }) };
    }

    // 1️⃣ Trust level & persona
    const trustLevel = getTrustLevel(sessionId);
    const persona    = await loadPersona(trustLevel, "odalys");
    const system     = buildSystemPrompt(persona);

    // 2️⃣ Rolling memory
    const mem     = contextCache[sessionId] = contextCache[sessionId] || [];
    const history = mem.slice(-6);

    // 3️⃣ Query the model
    const reply = await getOpenAIReply(system, history, userMessage);

    // 4️⃣ Update memory & trust
    mem.push({ role: "user",      content: userMessage });
    mem.push({ role: "assistant", content: reply       });
    addTrustPoints(sessionId, userMessage);

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel })
    };

  } catch (err) {
    console.error("💥 Fatal chat.js error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chat handler crashed", details: err.message })
    };
  }
};
