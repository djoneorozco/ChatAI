// trustManager.js

//#1: Trust Configuration
tconst LEVELS = [
  { level: 1, label: "Guarded", color: "#cccccc" },
  { level: 2, label: "Testing", color: "#dddddd" },
  { level: 3, label: "Warming Up", color: "#a3c9f1" },
  { level: 4, label: "Warming Up+", color: "#7ab7f0" },
  { level: 5, label: "Flirty Flow", color: "#c299ff" },
  { level: 6, label: "Flirty+", color: "#aa66ff" },
  { level: 7, label: "Open Book", color: "#ff6e6e" },
  { level: 8, label: "Bold Statements", color: "#ff4a4a" },
  { level: 9, label: "Sexual Energy", color: "#d00000" },
  { level: 10, label: "Girlfriend Status", color: "#9b0000" },
];

const TRUST_PER_LEVEL = 10;

//#2: Message-Based Scoring Engine
function updateTrustScore(currentScore, message, isQuizPassed = false) {
  let score = currentScore;
  if (!message || typeof message !== "string") return score;
  const msg = message.toLowerCase().trim();

  // 🚫 Penalties
  if (/bitch|tits|suck|dick|whore|slut/.test(msg)) return Math.max(score - 5, 0);
  if (/fuck|nudes|desperate/.test(msg)) return Math.max(score - 3, 0);
  if (/please|show me|now/.test(msg)) return Math.max(score - 1, 0);

  // ✅ Quiz bonus
  if (isQuizPassed) return Math.min(score + 10, 100);

  const tokenCount = msg.split(/\s+/).length;
  const hobbySignals = /hobbies|do you.*like|side hustle|job|career|favorite movie|music|netflix|team|nba|nfl/gi;
  const keywordMatches = (msg.match(hobbySignals) || []).length;

  let bonus = 0;
  if (keywordMatches >= 4)      bonus = 5;
  else if (keywordMatches >= 2) bonus = 3;
  else                          bonus = tokenCount >= 15 ? 2 : 1;

  return Math.min(score + bonus, 100);
}

//#3: In-Memory Trust Scores per Session
tconst trustScores = {}; // { [sessionId]: number }

/**
 * Adds trust points for a session based on user message
 * @param {string} sessionId
 * @param {string} message
 * @param {boolean} isQuizPassed
 */
function addTrustPoints(sessionId, message, isQuizPassed = false) {
  const current = trustScores[sessionId] || 0;
  trustScores[sessionId] = updateTrustScore(current, message, isQuizPassed);
}

/**
 * Returns numeric trust level (1–10) for a session
 * @param {string} sessionId
 * @returns {number}
 */
function getTrustLevel(sessionId) {
  const score = trustScores[sessionId] || 0;
  return Math.min(Math.floor(score / TRUST_PER_LEVEL) + 1, 10);
}

module.exports = {
  LEVELS,
  addTrustPoints,
  getTrustLevel,
};


// chat.js – Netlify Function with JSON Persona + Trust + Memory

const fs = require("fs").promises;
const path = require("path");
const { OpenAI } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// In-memory rolling context per session
tconst contextCache = {};

// Load persona JSON for a given level
async function loadPersona(level = 1, name = "odalys") {
  const file = `level-${level}.json`;
  const full = path.join(__dirname, "personas", name, file);
  const raw = await fs.readFile(full, "utf-8");
  return JSON.parse(raw);
}

// Build system prompt from persona
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
- Ask only short follow‑ups like "You?", "Why?", "When?"
`;
}

// Query OpenAI via v4 SDK
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

// Netlify Lambda
exports.handler = async (event) => {
  try {
    const sessionId   = event.headers["x-session-id"] || "default";
    const { message: userMessage = "" } = JSON.parse(event.body || "{}");
    if (!userMessage) return { statusCode: 400, body: JSON.stringify({ error: "No message." }) };

    // 1) Trust level & persona
    const trustLevel = getTrustLevel(sessionId);
    const persona    = await loadPersona(trustLevel, "odalys");
    const system     = buildSystemPrompt(persona);

    // 2) Memory
    const mem    = contextCache[sessionId] = contextCache[sessionId] || [];
    const history= mem.slice(-6);

    // 3) Ask model
    const reply  = await getOpenAIReply(system, history, userMessage);

    // 4) Update memory & trust
    mem.push({ role: "user",      content: userMessage });
    mem.push({ role: "assistant", content: reply      });
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
