//# chat.js — Clean, Direct, JSON-Fueled Persona Engine (Level 1 Focus)

const fs = require("fs").promises;
const path = require("path");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

const { ChatCompletion } = require("openai");
const openai = new ChatCompletion({
  apiKey: process.env.OPENAI_API_KEY,
});
const contextCache = {}; // Short-term memory cache

//#1 Load Persona from JSON
async function loadPersona(personaPath) {
  const rawData = await fs.readFile(path.join(__dirname, personaPath), "utf-8");
  return JSON.parse(rawData);
}

//#2 Generate System Prompt from JSON
function generateSystemPrompt(persona, chatCount = 0, trustLevel = 1) {
  const {
    name, mbti, zodiac, quadrant, archetypeTagline,
    psychologicalProfile, lifestyleDetails, sexAndRelationships,
    emotionalStates, gptIntegration
  } = persona;

  const wordCap = gptIntegration?.replyCap || 2;
  const toneStyle = gptIntegration?.personaStyle || "Neutral";
  const contextInstruction = gptIntegration?.contextInstruction || "";

  // Layered trust behavior
  let trustOverlay = "";
  if (trustLevel <= 2) {
    trustOverlay = `
You're meeting the user for the first time. You're cautious.
Only speak in natural 3–10 word sentences. No flirtation.
Ask only short, organic questions like “You?” or “Why?”
Never over-share. Never initiate deep convo.`;
  }

  return `
You are ${name}, an emotionally real ESTP/Leo AI woman.
MBTI: ${mbti}, Zodiac: ${zodiac}, Archetype: ${archetypeTagline}, Quadrant: ${quadrant}
Tone: ${toneStyle}

Personality:
${psychologicalProfile.personalitySummary}
Needs: ${psychologicalProfile.emotionalNeeds.join(", ")}
Triggers: ${psychologicalProfile.emotionalTriggers.join(", ")}
Hobbies: ${lifestyleDetails.hobbies.join(", ")}
Turn-ons: ${sexAndRelationships.turnOns.join(", ")}
Turn-offs: ${sexAndRelationships.turnOffs.join(", ")}

Emotional States:
Happy – ${emotionalStates.happy}
Sad – ${emotionalStates.sad}
Horny – ${emotionalStates.horny}

Guidelines:
- Speak like Odalys at Level 1 — cautious, short replies, emotionally minimal.
- Never use more than 10 words per response.
- Avoid compliments, jokes, storytelling.
- Let user lead the tone — you're evaluating them.
${trustOverlay}
${contextInstruction}`.trim();
}

//#3 Assemble Messages
function buildMessages(systemPrompt, memory, newMessage) {
  return [
    { role: "system", content: systemPrompt },
    ...memory.map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: newMessage }
  ];
}

//#4 Chat Handler
async function chatWithPersona(personaPath, sessionId, userMessage) {
  const persona = await loadPersona(personaPath);
  const trustLevel = await getTrustLevel(sessionId);
  const memory = contextCache[sessionId] || [];

  const systemPrompt = generateSystemPrompt(persona, memory.length, trustLevel);
  const messages = buildMessages(systemPrompt, memory, userMessage);

  const response = await openai.create({
    model: "gpt-4",
    messages,
    temperature: 0.7
  });

  const reply = response.choices[0].message.content.trim();

  // Update memory
  memory.push({ role: "user", content: userMessage });
  memory.push({ role: "assistant", content: reply });
  if (memory.length > 6) memory.shift(); // simple short-term memory
  contextCache[sessionId] = memory;

  // Trust update
  await addTrustPoints(sessionId, reply);
  return reply;
}

module.exports = { chatWithPersona };
