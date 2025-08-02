// trustManager.js (v2.0 – Trust Progress via Level JSON Matching)

const fs = require("fs").promises;
const path = require("path");

const TRUST_FILE = path.join(__dirname, "progress.json");
const MAX_LEVEL = 10;

// Load existing progress or default
async function loadProgress() {
  try {
    const data = await fs.readFile(TRUST_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {}; // No file yet
  }
}

// Save progress back to file
async function saveProgress(progress) {
  await fs.writeFile(TRUST_FILE, JSON.stringify(progress, null, 2));
}

// Get trust level (1–10) for a persona
async function getTrustLevel(persona) {
  const progress = await loadProgress();
  return progress[persona]?.level || 1;
}

// Add trust points and auto-update level
async function addTrustPoints(points = 1, persona) {
  const progress = await loadProgress();

  if (!progress[persona]) {
    progress[persona] = { points: 0, level: 1 };
  }

  progress[persona].points += points;

  // Define how many points per level up (you can adjust this scale)
  const levelUpThreshold = 20;

  const newLevel = Math.min(
    MAX_LEVEL,
    Math.floor(progress[persona].points / levelUpThreshold) + 1
  );

  progress[persona].level = newLevel;

  await saveProgress(progress);
}

// Optional: Reset a persona (for debugging)
async function resetPersona(persona) {
  const progress = await loadProgress();
  delete progress[persona];
  await saveProgress(progress);
}

module.exports = {
  getTrustLevel,
  addTrustPoints,
  resetPersona,
};
