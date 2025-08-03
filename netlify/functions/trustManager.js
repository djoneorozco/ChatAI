//# trustManager.js

// 1️⃣ Trust Configuration
const LEVELS = [
  { level: 1, label: "Guarded",       color: "#cccccc" },
  { level: 2, label: "Testing",       color: "#dddddd" },
  { level: 3, label: "Warming Up",    color: "#a3c9f1" },
  { level: 4, label: "Warming Up+",   color: "#7ab7f0" },
  { level: 5, label: "Flirty Flow",   color: "#c299ff" },
  { level: 6, label: "Flirty+",       color: "#aa66ff" },
  { level: 7, label: "Open Book",     color: "#ff6e6e" },
  { level: 8, label: "Bold Statements", color: "#ff4a4a" },
  { level: 9, label: "Sexual Energy", color: "#d00000" },
  { level: 10,label: "Girlfriend Status", color: "#9b0000" },
];
const TRUST_PER_LEVEL = 10;

// 2️⃣ In-Memory Store of raw trust scores, keyed by sessionId
const trustScores = {};

// 3️⃣ Compute new trust‐score from message
function updateTrustScore(currentScore, message, isQuizPassed = false) {
  let score = currentScore;
  if (!message || typeof message !== "string") return score;

  const msg = message.toLowerCase().trim();

  // 🚫 Penalties
  if (/bitch|tits|suck|dick|whore|slut/.test(msg))   return Math.max(score - 5,  0);
  if (/fuck|nudes|desperate/.test(msg))             return Math.max(score - 3,  0);
  if (/please|show me|now/.test(msg))               return Math.max(score - 1,  0);

  // ✅ Quiz pass
  if (isQuizPassed) return Math.min(score + 10, 100);

  // ✨ Rewards
  const tokenCount = msg.split(/\s+/).length;
  const hobbySignals = /hobbies|do you.*like|job|career|music|team/gi;
  const hits = (msg.match(hobbySignals) || []).length;

  let bonus = tokenCount >= 15 ? 2 : 1;
  if (hits >= 4) bonus = 5;
  else if (hits >= 2) bonus = 3;

  return Math.min(score + bonus, 100);
}

// 4️⃣ Public: add points for this session
function addTrustPoints(sessionId, message, isQuizPassed = false) {
  const current = trustScores[sessionId] || 0;
  const updated = updateTrustScore(current, message, isQuizPassed);
  trustScores[sessionId] = updated;
  return updated;
}

// 5️⃣ Public: get 1–10 trust level from session
function getTrustLevel(sessionId) {
  const score = trustScores[sessionId] || 0;
  const lvl = Math.min(Math.floor(score / TRUST_PER_LEVEL) + 1, 10);
  return lvl;
}

// 6️⃣ (Optional) progress percent within current level
function getTrustProgress(sessionId) {
  const score = trustScores[sessionId] || 0;
  const level = getTrustLevel(sessionId);
  const base  = (level - 1) * TRUST_PER_LEVEL;
  const cur   = score - base;
  const pct   = Math.min((cur / TRUST_PER_LEVEL) * 100, 100);
  return { level, percent: pct };
}

module.exports = {
  addTrustPoints,
  getTrustLevel,
  getTrustProgress,
  LEVELS
};
