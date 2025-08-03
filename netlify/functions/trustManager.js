// trustManager.js

//#1: Trust Configuration
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
const trustScores = {}; // { [sessionId]: number }

/**
 * Adds trust points for a session based on user message
 */
function addTrustPoints(sessionId, message, isQuizPassed = false) {
  const current = trustScores[sessionId] || 0;
  trustScores[sessionId] = updateTrustScore(current, message, isQuizPassed);
}

/**
 * Returns numeric trust level (1–10) for a session
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
