const path = require("path");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

async function handleProgress(persona, userId, lastReply) {
  const pointsEarned = calculatePoints(lastReply); // You define the rules here
  await addTrustPoints(persona, userId, pointsEarned);

  const trustLevel = await getTrustLevel(persona, userId);
  const level = Math.ceil(trustLevel / 10); // e.g., 21 → Level 3

  const personaPath = path.join(
    __dirname,
    "personas",
    persona,
    `level-${level}.json`
  );

  const personaJson = require(personaPath);
  return {
    trustLevel,
    level,
    imageUnlock: personaJson.imageUnlock,
    personaJson
  };
}
