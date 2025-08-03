// chat.js – Netlify Function with JSON Persona + Trust + Memory

const fs   = require("fs").promises;
const path = require("path");
const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// In-memory rolling context per session
const contextCache = {};

/**
 * Load persona JSON for a given trust level and persona name
 * @param {number} level
 * @param {string} name
 */
async function loadPersona(level = 1, name = "odalys") {
  const file = `level-${level}.json`;
  const full = path.join(__dirname, "personas", name, file);
  const raw  = await fs.readFile(full, "utf-8");
  return JSON.parse(raw);
}

/**
 * Build the system prompt from persona JSON
 * @param {object} p
 */
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
- Ask only short follow-ups like "You?", "Why?", "When?"
`;
}

/**
 * Query OpenAI via v4 SDK
 * @param {string} system
 * @param {Array}  memory
 * @param {string} user
 */
async function getOpenAIReply(system, memory, user) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const msgs   = [
    { role: "system",  content: system },
    ...memory,
    { role: "user",    content: user   }
  ];

  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages:    msgs
  });

  return res.choices[0].message.content.trim();
}

// Netlify Lambda entrypoint
exports.handler = async (event) => {
  try {
    const sessionId      = event.headers["x-session-id"] || "default";
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");
    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message." }) };
    }

    // 1) Determine trust level & load persona JSON
    const trustLevel = getTrustLevel(sessionId);
    const persona    = await loadPersona(trustLevel, "odalys");
    const system     = buildSystemPrompt(persona);

    // 2) Rolling memory
    const mem     = contextCache[sessionId] = contextCache[sessionId] || [];
    const history = mem.slice(-6);

    // 3) Query the model
    const reply = await getOpenAIReply(system, history, userMessage);

    // 4) Update memory & trust
    mem.push({ role: "user",      content: userMessage });
    mem.push({ role: "assistant", content: reply       });
    addTrustPoints(sessionId, userMessage);

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
