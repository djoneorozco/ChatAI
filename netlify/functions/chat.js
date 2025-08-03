// netlify/functions/chat.js
const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// --- 1) Statically import your persona files so esbuild bundles them ---
const odalysPersonas = {
  1: require("./personas/odalys/level-1.json"),
  2: require("./personas/odalys/level-2.json"),
  3: require("./personas/odalys/level-3.json"),
  4: require("./personas/odalys/level-4.json"),
  // when you add level-5.json … level-10.json, just drop them in and
  // add lines here:
  // 5: require("./personas/odalys/level-5.json"),
  // … etc.
};

// --- 2) Build the system prompt from persona JSON ---
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
Needs: ${psychologicalProfile.emotionalNeeds.join(", ")}
Triggers to avoid: ${psychologicalProfile.emotionalTriggers.join(", ")}

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

// --- 3) Query OpenAI via the v4 SDK ---
async function getOpenAIReply(system, history, userMessage) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system",  content: system      },
    ...history,
    { role: "user",    content: userMessage },
  ];

  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages,
  });

  return res.choices[0].message.content.trim();
}

// --- 4) In-memory rolling context per session ---
const contextCache = {};

// --- 5) Netlify Lambda entrypoint ---
exports.handler = async (event) => {
  try {
    // parse input
    const sessionId = (event.headers["x-session-id"] || "default");
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");
    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message." }) };
    }

    // determine trust and pick persona JSON
    const trustLevel = getTrustLevel(sessionId);
    const persona    = odalysPersonas[trustLevel] || odalysPersonas[1];
    console.log(`[chat] using trustLevel=${trustLevel}, persona level-${persona.level}.json`);

    // build prompt
    const systemPrompt = buildSystemPrompt(persona);

    // rolling memory: last 6 turns
    const mem     = contextCache[sessionId] = contextCache[sessionId] || [];
    const history = mem.slice(-6);

    // ask the model
    const reply = await getOpenAIReply(systemPrompt, history, userMessage);

    // update memory & trust
    mem.push({ role: "user",      content: userMessage });
    mem.push({ role: "assistant", content: reply       });
    addTrustPoints(sessionId, userMessage);

    // respond
    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel }),
    };

  } catch (err) {
    console.error("Fatal chat.js error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chat handler crashed", details: err.message }),
    };
  }
};
