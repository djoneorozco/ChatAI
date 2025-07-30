//# trustManager.js

//#1: Trust Configuration
const LEVELS = [
  { level: 1, label: "Guarded", color: "#cccccc" }, // white/gray
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

const TRUST_PER_LEVEL = 10; // 10 points per level

//#2: Trust Score Engine
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

//#3: Score Update Handler
function updateTrustScore(currentScore, message, isQuizPassed = false) {
  let score = currentScore;
  const msg = message.toLowerCase();

  // Penalties
  if (/bitch|tits|suck|dick|whore|slut/.test(msg)) return Math.max(score - 5, 0);
  if (/fuck|nudes|desperate/.test(msg)) return Math.max(score - 3, 0);
  if (/please|show me|now/.test(msg)) return Math.max(score - 1, 0);

  // Quiz boost
  if (isQuizPassed) return Math.min(score + 10, 100);

  // Message score
  const tokenCount = message.split(" ").length;
  const bonus = tokenCount >= 15 ? 3 : 1;
  return Math.min(score + bonus, 100);
}

//#4: Export
export { LEVELS, getTrustLevel, getTrustProgress, updateTrustScore };
