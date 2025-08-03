// chat.js — Netlify Function with static JSON imports

const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// 1) Static JSON imports so esbuild bundles them
const L1 = require("./personas/odalys/level-1.json");
const L2 = require("./personas/odalys/level-2.json");
const L3 = require("./personas/odalys/level-3.json");
const L4 = require("./personas/odalys/level-4.json");

const PERSONAS = { 1: L1, 2: L2, 3: L3, 4: L4 };

// 2) In-memory rolling context per session
const contextCache = {};

function buildSystemPrompt(p) {
  const {
    name,
    archetypeTagline,
    psychologicalProfile = {},
    lifestyleDetails = {},
    sexAndRelationships = {},
    emotionalStates = {},
    gptIntegration = {}
  } = p;

  const style = gptIntegration.personaStyle || "Reserved";
  const cap   = gptIntegration.replyCap || 10;

  return `
You are ${name}, ${archetypeTagline}.

Summary: ${psychologicalProfile.personalitySummary || ""}
Needs: ${(psychologicalProfile.emotionalNeeds || []).join(", ")}

Hobbies: ${(lifestyleDetails.hobbies || []).join(", ")}
Turn-ons: ${(sexAndRelationships.turnOns || []).join(", ")}
Turn-offs: ${(sexAndRelationships.turnOffs || []).join(", ")}

Emotional States:
 • Happy: ${emotionalStates.happy || ""}
 • Sad:   ${emotionalStates.sad || ""}
 • Horny: ${emotionalStates.horny || ""}

Rules:
- Speak ${style.toLowerCase()}, max ${cap} words.
- No flirting until trust grows.
- Ask only short follow-ups.
`;
}

async function getOpenAIReply(system, history, userMessage) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system",  content: system },
    ...history,
    { role: "user",    content: userMessage }
  ];
  const res = await openai.chat.completions.create({
    model:       "gpt-4",
    temperature: 0.7,
    messages
  });
  return res.choices[0].message.content.trim();
}

exports.handler = async (event) => {
  try {
    const sessionId     = event.headers["x-session-id"] || "default";
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");
    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message." }) };
    }

    // 1) Determine trust & pick persona JSON
    const trustLevel = getTrustLevel(sessionId);
    const persona    = PERSONAS[trustLevel] || L1;

    // 2) Build prompt
    const system     = buildSystemPrompt(persona);

    // 3) Manage rolling memory
    const mem    = contextCache[sessionId] = contextCache[sessionId] || [];
    const history = mem.slice(-6);

    // 4) Query OpenAI
    const reply  = await getOpenAIReply(system, history, userMessage);

    // 5) Update memory & trust
    mem.push({ role: "user",      content: userMessage });
    mem.push({ role: "assistant", content: reply       });
    addTrustPoints(sessionId, userMessage);

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel })
    };

  } catch (err) {
    console.error("🔥 chat.js error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chat handler crashed", details: err.message })
    };
  }
};
