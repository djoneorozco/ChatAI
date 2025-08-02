//# trustManager.js (Persona-Aware, Safe for Netlify)

//#1: Trust Level Configuration
const LEVELS = [
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

//#2: In-Memory Persona Trust Score Map
const trustScores = {}; // e.g., { odalys: 17, leila: 32 }

//#3: Logic Helpers
function getTrustLevel(score) {
  const level = Math.min(Math.floor(score / TRUST_PER_LEVEL) + 1, 10);
  return LEVELS[level - 1];
}

function getTrustProgress(score) {
  const level = getTrustLevel(score).level;
  const base = (level - 1) * TRUST_PER_LEVEL;
  const current = score - base;
  const percent = Math.min((current / TRUST_PER_LEVEL) * 100, 100);
  return { level, percent };
}

function updateTrustScore(currentScore, message, isQuizPassed = false) {
  let score = currentScore;
  if (!message || typeof message !== "string") return score;

  const msg = message.toLowerCase().trim();

  // 🚫 Negative triggers
  if (/bitch|tits|suck|dick|whore|slut/.test(msg)) return Math.max(score - 5, 0);
  if (/fuck|nudes|desperate/.test(msg)) return Math.max(score - 3, 0);
  if (/please|show me|now/.test(msg)) return Math.max(score - 1, 0);

  // ✅ Quiz bonus
  if (isQuizPassed) return Math.min(score + 10, 100);

  // 🎯 Keyword bonuses
  const hobbySignals = /hobbies|do you.*like|side hustle|job|career|favorite movie|music|netflix|team|nba|nfl/gi;
  const tokenCount = msg.split(/\s+/).length;
  const keywordMatches = (msg.match(hobbySignals) || []).length;

  let bonus = 0;
  if (keywordMatches >= 4) bonus = 5;
  else if (keywordMatches >= 2) bonus = 3;
  else bonus = tokenCount >= 15 ? 2 : 1;

  return Math.min(score + bonus, 100);
}

//#4: Public API
async function addTrustPoints(message, persona = "default") {
  const current = trustScores[persona] || 0;
  const updated = updateTrustScore(current, message);
  trustScores[persona] = updated;
}

async function getTrustLevelFor(persona = "default") {
  const score = trustScores[persona] || 0;
  return getTrustLevel(score).level;
}

async function getTrustProgressFor(persona = "default") {
  const score = trustScores[persona] || 0;
  return getTrustProgress(score);
}

async function forceTrustLevel(persona = "default", level = 1) {
  trustScores[persona] = (level - 1) * TRUST_PER_LEVEL;
}

module.exports = {
  LEVELS,
  addTrustPoints,
  getTrustLevelFor,
  getTrustProgressFor,
  forceTrustLevel,
};
