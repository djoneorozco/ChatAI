// netlify/functions/chat.js

const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// —––– require all levels at build time
const level1 = require("./personas/odalys/level-1.json");
const level2 = require("./personas/odalys/level-2.json");
const level3 = require("./personas/odalys/level-3.json");
const level4 = require("./personas/odalys/level-4.json");
// …and so on up through level-10 if you have them
const personaMap = {
  1: level1,
  2: level2,
  3: level3,
  4: level4,
  // 5: require("./personas/odalys/level-5.json"),
  // …
};

/**
 * “Load” a persona by looking up the in-memory map.
 */
function loadPersona(level = 1) {
  return personaMap[level] || level1;
}

/**
 * Build the system prompt from persona JSON.
 */
function buildSystemPrompt(p) {
  const {
    name,
    mbti,
    zodiac,
    quadrant,
    archetypeTagline,
    psychologicalProfile,
    lifestyleDetails = {},
    sexAndRelationships = {},
    emotionalStates = {},
    gptIntegration = {}
  } = p;

  const style    = gptIntegration.personaStyle || "Reserved";
  const cap      = gptIntegration.replyCap       || 10;
  const hobbies  = (lifestyleDetails.hobbies || []).join(", ")    || "—";
  const turnOns  = (sexAndRelationships.turnOns || []).join(", ")  || "—";
  const turnOffs = (sexAndRelationships.turnOffs || []).join(", ") || "—";

  return `
You are ${name}, ${archetypeTagline} (${mbti}, ${zodiac}, ${quadrant}).

Summary: ${psychologicalProfile.personalitySummary}
Emotional Needs: ${(psychologicalProfile.emotionalNeeds || []).join(", ")}
Emotional Triggers: ${(psychologicalProfile.emotionalTriggers || []).join(", ")}

Hobbies: ${hobbies}
Turn-ons: ${turnOns}
Turn-offs: ${turnOffs}

Emotional States:
  • Happy: ${emotionalStates.happy || "—"}
  • Sad:   ${emotionalStates.sad   || "—"}
  • Horny: ${emotionalStates.horny || "—"}

Rules:
- Speak ${style.toLowerCase()}, max ${cap} words per reply.
- No flirting until trust grows.
- Ask only short follow-ups like “You?”, “Why?”, “When?”.
`.trim();
}

/**
 * Ask OpenAI for a chat completion.
 */
async function getOpenAIReply(system, memory, userText) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system",  content: system   },
    ...memory,
    { role: "user",    content: userText }
  ];

  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages
  });

  return res.choices[0].message.content.trim();
}

// In-memory chat history by session
const contextCache = {};

/**
 * Netlify Function entrypoint
 */
exports.handler = async (event) => {
  try {
    const sessionId = event.headers["x-session-id"] || "default";
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");

    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message provided." }) };
    }

    // 1) figure out trust
    const trustLevel = getTrustLevel(sessionId);

    // 2) grab the right persona blob
    const persona = loadPersona(trustLevel);

    // 3) build the system
    const system  = buildSystemPrompt(persona);

    // 4) get the last 6 msgs
    const mem     = (contextCache[sessionId] = contextCache[sessionId] || []);
    const history = mem.slice(-6);

    // 5) ask GPT
    const reply   = await getOpenAIReply(system, history, userMessage);

    // 6) stash user + bot into memory & bump trust
    mem.push({ role: "user",      content: userMessage });
    mem.push({ role: "assistant", content: reply       });
    addTrustPoints(sessionId, userMessage);

    // 7) return
    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel })
    };

  } catch (err) {
    console.error("💥 chat.js crashed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal error", details: err.message })
    };
  }
};
