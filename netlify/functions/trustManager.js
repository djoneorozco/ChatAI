//# trustManager.js
// In-memory per-session trust scoring

const TRUST_PER_LEVEL = 10;
const sessionScores = {};    // { [sessionId]: score }

const LEVELS = [
  { level: 1, label: "Guarded",      color: "#cccccc" },
  { level: 2, label: "Testing",      color: "#dddddd" },
  { level: 3, label: "Warming Up",   color: "#a3c9f1" },
  { level: 4, label: "Warming Up+",  color: "#7ab7f0" },
  { level: 5, label: "Flirty Flow",  color: "#c299ff" },
  { level: 6, label: "Flirty+",      color: "#aa66ff" },
  { level: 7, label: "Open Book",    color: "#ff6e6e" },
  { level: 8, label: "Bold",         color: "#ff4a4a" },
  { level: 9, label: "Sexual Energy",color: "#d00000" },
  { level:10, label: "Girlfriend",   color: "#9b0000" },
];

// — Given a raw score, compute 1–10 level
function levelFromScore(score) {
  return Math.min(Math.floor(score / TRUST_PER_LEVEL) + 1, 10);
}

// — Public: bump/penalize trust based on a new message
function updateTrust(sessionId, message = "") {
  let score = sessionScores[sessionId] || 0;
  const msg = message.toLowerCase();

  // Penalties
  if (/bitch|tits|suck|dick|whore|slut/.test(msg)) {
    score = Math.max(score - 5, 0);
  } else if (/fuck|nudes|desperate/.test(msg)) {
    score = Math.max(score - 3, 0);
  } else if (/please|show me|now/.test(msg)) {
    score = Math.max(score - 1, 0);
  } else {
    // Reward: length+keywords
    const tokens = msg.split(/\s+/).length;
    const keyMatches = (msg.match(/hobbies|job|music|favorite|movie/gi)||[]).length;
    let bonus = keyMatches >= 4 ? 5 : keyMatches >= 2 ? 3 : tokens >= 15 ? 2 : 1;
    score = Math.min(score + bonus, TRUST_PER_LEVEL * 10);
  }

  sessionScores[sessionId] = score;
  return score;
}

// — Public: get current trust *level* (1–10)
function getTrustLevel(sessionId) {
  const score = sessionScores[sessionId] || 0;
  return levelFromScore(score);
}

module.exports = { updateTrust, getTrustLevel, LEVELS };
