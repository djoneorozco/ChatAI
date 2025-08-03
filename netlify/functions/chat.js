// chat.js – Netlify Function with JSON Persona + Trust + Memory

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
  const file = `level-${level}.json`;
  const full = path.join(__dirname, "personas", name, file);
  const raw  = await fs.readFile(full, "utf-8");
  const p    = JSON.parse(raw);
  console.log("🔍 loaded persona:", full, p);
  return p;
}

/**
 * Build the system prompt from persona JSON,
 * injecting greeting & origin up‐front
 */
function buildSystemPrompt(p) {
  let prompt = "";

  // 1) Custom greeting (e.g. "Hey. I'm Odalys.")
  if (p.greeting) {
    prompt += `${p.greeting}\n`;
  }

  // 2) Origin / hometown
  if (p.personalityBackground?.origin) {
    prompt += `I’m from ${p.personalityBackground.origin}.\n\n`;
  }

  // 3) Main persona scaffold
  prompt += `You are ${p.name}, ${p.archetypeTagline} (${p.mbti}, ${p.zodiac}, ${p.quadrant}).\n\n`;
  prompt += `Summary: ${p.psychologicalProfile.personalitySummary}\n`;
  prompt += `Emotional needs: ${p.psychologicalProfile.emotionalNeeds.join(", ")}\n`;
  prompt += `Triggers to avoid: ${p.psychologicalProfile.emotionalTriggers.join(", ")}\n\n`;

  prompt += `Hobbies: ${p.lifestyleDetails.hobbies.join(", ")}\n`;
  prompt += `Turn-ons: ${p.sexAndRelationships.turnOns.join(", ")}\n`;
  prompt += `Turn-offs: ${p.sexAndRelationships.turnOffs.join(", ")}\n\n`;

  prompt += `Emotional States:\n`;
  prompt += `  • Happy: ${p.emotionalStates.happy}\n`;
  prompt += `  • Sad:   ${p.emotionalStates.sad}\n`;
  prompt += `  • Horny: ${p.emotionalStates.horny}\n\n`;

  prompt += `Rules:\n`;
  prompt += `- Speak ${p.gptIntegration.personaStyle.toLowerCase() || "reserved"}, max ${p.gptIntegration.replyCap || 10} words.\n`;
  prompt += `- No flirting until trust grows.\n`;
  prompt += `- Ask only short follow-ups like "You?", "Why?", "When?"\n`;

  return prompt;
}

/**
 * Query OpenAI via v4 SDK
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
    const mem     = (contextCache[sessionId] = contextCache[sessionId] || []);
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
