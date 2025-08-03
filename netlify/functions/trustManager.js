//# trustManager.js

// 1️⃣ Level definitions
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

// In-memory per-session scores
const sessionScores = {};

// Helper: get or init score
function getScore(sessionId) {
  return sessionScores[sessionId] || 0;
}

// Helper: clamp and store score
function setScore(sessionId, score) {
  sessionScores[sessionId] = Math.max(0, Math.min(100, score));
}

// 2️⃣ Compute numeric trust level (1–10)
function getTrustLevel(sessionId) {
  const score = getScore(sessionId);
  const level = Math.min(Math.floor(score / TRUST_PER_LEVEL) + 1, 10);
  return level;
}

// 3️⃣ Update score based on message content
function updateTrustScore(sessionId, message, isQuizPassed = false) {
  let score = getScore(sessionId);
  if (!message || typeof message !== "string") {
    setScore(sessionId, score);
    return;
  }

  const msg = message.toLowerCase().trim();

  // 🚫 Penalties
  if (/bitch|tits|suck|dick|whore|slut/.test(msg)) {
    score = Math.max(score - 5, 0);
    setScore(sessionId, score);
    return;
  }
  if (/fuck|nudes|desperate/.test(msg)) {
    score = Math.max(score - 3, 0);
    setScore(sessionId, score);
    return;
  }
  if (/please|show me|now/.test(msg)) {
    score = Math.max(score - 1, 0);
    setScore(sessionId, score);
    return;
  }

  // ✅ Quiz bonus
  if (isQuizPassed) {
    score = Math.min(score + 10, 100);
    setScore(sessionId, score);
    return;
  }

  // 🍀 Positive engagement
  const tokenCount = msg.split(/\s+/).length;
  const hobbySignals = /hobbies|do you.*like|side hustle|job|career|favorite movie|music|netflix|team|nba|nfl/gi;
  const keywordMatches = (msg.match(hobbySignals) || []).length;

  let bonus = 0;
  if (keywordMatches >= 4) bonus = 5;
  else if (keywordMatches >= 2) bonus = 3;
  else bonus = tokenCount >= 15 ? 2 : 1;

  score = Math.min(score + bonus, 100);
  setScore(sessionId, score);
}

// 4️⃣ (Optional) Reset or decay if needed
function decayTrust(sessionId) {
  const score = getScore(sessionId);
  setScore(sessionId, score - 1);
}

module.exports = {
  getTrustLevel,
  updateTrustScore,
  decayTrust,
};
