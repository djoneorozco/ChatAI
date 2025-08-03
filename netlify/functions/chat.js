// netlify/functions/chat.js

const fs        = require("fs").promises;
const path      = require("path");
const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// In-memory rolling context per session
const contextCache = {};

/**
 * Load persona JSON for a given trust level and persona name.
 * This path will resolve once you’ve set `included_files = ["personas/odalys/*.json"]`
 * in your netlify.toml (relative to netlify/functions).
 */
async function loadPersona(level = 1, name = "odalys") {
  const file = `level-${level}.json`;
  const full = path.join(__dirname, "personas", name, file);
  console.log(`[chat] Loading persona JSON from: ${full}`);
  const raw  = await fs.readFile(full, "utf-8");
  return JSON.parse(raw);
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
  const cap      = gptIntegration.replyCap || 10;
  const hobbies  = (lifestyleDetails.hobbies || []).join(", ") || "—";
  const turnOns  = (sexAndRelationships.turnOns || []).join(", ") || "—";
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
- Speak ${style.toLowerCase()}; max ${cap} words per reply.
- No flirting until trust grows.
- Ask only short follow-ups like “You?”, “Why?”, “When?”.
`.trim();
}

/**
 * Query OpenAI via v4 SDK.
 */
async function getOpenAIReply(system, memory, userText) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system",  content: system    },
    ...memory,
    { role: "user",    content: userText  }
  ];

  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages
  });

  return res.choices[0].message.content.trim();
}

/**
 * Netlify Lambda handler.
 */
exports.handler = async (event) => {
  try {
    const sessionId = event.headers["x-session-id"] || "default";
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");

    if (!userMessage) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No message provided." })
      };
    }

    // 1) Determine trust level & load the appropriate persona file
    const trustLevel = getTrustLevel(sessionId);
    const persona    = await loadPersona(trustLevel, "odalys");
    const system     = buildSystemPrompt(persona);

    // 2) Rolling memory (keep last 6 messages)
    const mem     = (contextCache[sessionId] = contextCache[sessionId] || []);
    const history = mem.slice(-6);

    // 3) Ask OpenAI
    const reply   = await getOpenAIReply(system, history, userMessage);

    // 4) Update memory & trust
    mem.push({ role: "user",      content: userMessage });
    mem.push({ role: "assistant", content: reply      });
    addTrustPoints(sessionId, userMessage);

    // 5) Return
    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel })
    };

  } catch (err) {
    console.error("❌ Fatal chat.js error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error:   "Chat handler crashed",
        details: err.message
      })
    };
  }
};
