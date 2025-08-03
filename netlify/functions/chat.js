// netlify/functions/chat.js

const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// ─────────────────────────────────────────────────────────────────────────────
// 1) Statically require all persona JSON levels so esbuild bundles them.
//    No more dynamic fs.readFile at runtime!
// ─────────────────────────────────────────────────────────────────────────────
const level1  = require("./personas/odalys/level-1.json");
const level2  = require("./personas/odalys/level-2.json");
const level3  = require("./personas/odalys/level-3.json");
const level4  = require("./personas/odalys/level-4.json");
const level5  = require("./personas/odalys/level-5.json");
const level6  = require("./personas/odalys/level-6.json");
const level7  = require("./personas/odalys/level-7.json");
const level8  = require("./personas/odalys/level-8.json");
const level9  = require("./personas/odalys/level-9.json");
const level10 = require("./personas/odalys/level-10.json");

// Map of trustLevel → persona JSON
const personaMap = {
  1: level1,
  2: level2,
  3: level3,
  4: level4,
  5: level5,
  6: level6,
  7: level7,
  8: level8,
  9: level9,
  10: level10,
};

// ─────────────────────────────────────────────────────────────────────────────
// In-memory conversation cache per session
// ─────────────────────────────────────────────────────────────────────────────
const contextCache = {};

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
Emotional Needs: ${psychologicalProfile.emotionalNeeds.join(", ")}
Emotional Triggers: ${psychologicalProfile.emotionalTriggers.join(", ")}

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
`.trim();
}

/**
 * Query OpenAI via the v4 SDK.
 */
async function getOpenAIReply(system, memory, user) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system",  content: system },
    ...memory,
    { role: "user",    content: user   }
  ];

  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages
  });

  return res.choices[0].message.content.trim();
}

/**
 * Netlify Lambda handler
 */
exports.handler = async (event) => {
  try {
    // Session identification (could be cookie, header, etc.)
    const sessionId = event.headers["x-session-id"] || "default";

    // Parse user message
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");
    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message provided." }) };
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 1) Determine trust level, pick persona JSON
    // ───────────────────────────────────────────────────────────────────────────
    const trustLevel = getTrustLevel(sessionId);
    console.log("[chat] loading persona level:", trustLevel);
    const persona = personaMap[trustLevel] || level1;
    const system  = buildSystemPrompt(persona);

    // ───────────────────────────────────────────────────────────────────────────
    // 2) Rolling in-memory conversation
    // ───────────────────────────────────────────────────────────────────────────
    const mem     = contextCache[sessionId] = contextCache[sessionId] || [];
    const history = mem.slice(-6);

    // ───────────────────────────────────────────────────────────────────────────
    // 3) Call OpenAI
    // ───────────────────────────────────────────────────────────────────────────
    const reply = await getOpenAIReply(system, history, userMessage);

    // ───────────────────────────────────────────────────────────────────────────
    // 4) Update memory & trust score
    // ───────────────────────────────────────────────────────────────────────────
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
