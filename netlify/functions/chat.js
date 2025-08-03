//# chat.js — Persona-Driven, JSON-Fueled, Trust-Sensitive Chat Handler

const fs = require("fs").promises;
const path = require("path");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// In-memory short-term memory
const contextCache = {};

//#1 Load Persona from JSON
async function loadPersona(personaPath) {
  const rawData = await fs.readFile(path.join(__dirname, personaPath), "utf-8");
  return JSON.parse(rawData);
}

//#2 Build System Prompt from .json (Level-Aware)
function generateSystemPrompt(persona, chatCount = 0, trustLevel = 1) {
  const { name, mbti, zodiac, quadrant, archetypeTagline, psychologicalProfile,
    lifestyleDetails, sexAndRelationships, emotionalStates, gptIntegration } = persona;

  const wordCap = gptIntegration?.replyCap || 2;
  const style = gptIntegration?.personaStyle || "Neutral";
  const contextInstruction = gptIntegration?.contextInstruction || "You are a cautious stranger.";

  let trustOverlay = "";
  if (trustLevel <= 2) {
    trustOverlay = `You're meeting the user for the first time. Speak with guarded brevity. Share very little.`;
  }

  return `
You are ${name}, an emotionally intelligent AI character.
MBTI: ${mbti}, Zodiac: ${zodiac}, Archetype: ${archetypeTagline}, Quadrant: ${quadrant}

Tone Style: ${style}
${trustOverlay}

Personality Summary: ${psychologicalProfile.personalitySummary}
Triggers to avoid: ${psychologicalProfile.emotionalTriggers.join(", ")}
Emotional Needs: ${psychologicalProfile.emotionalNeeds.join(", ")}
Hobbies: ${lifestyleDetails.hobbies.join(", ")}
Turn-ons: ${sexAndRelationships.turnOns.join(", ")}
Turn-offs: ${sexAndRelationships.turnOffs.join(", ")}

Emotional States:
Happy: ${emotionalStates.happy}
Sad: ${emotionalStates.sad}
Horny: ${emotionalStates.horny}

Instructions:
- Your reply must sound real, human, and in Odalys’s voice.
- You are cautious right now. Avoid over-sharing or any hint of flirtation.
- Limit word count to under 10 words per reply until trust increases.
- Only ask 1-word follow-up questions: 'You?', 'Why?', etc.
- Sound natural, reserved, smart — like Odalys is watching.

${contextInstruction}`;
}

//#3 Format Messages for OpenAI
function buildMessages(systemPrompt, memory, newMessage) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...memory.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: newMessage }
  ];
  return messages;
}

//#4 Main Chat Handler
async function chatWithPersona(personaPath, sessionId, userMessage) {
  const persona = await loadPersona(personaPath);
  const trustLevel = await getTrustLevel(sessionId);
  const memory = contextCache[sessionId] || [];

  const systemPrompt = generateSystemPrompt(persona, memory.length, trustLevel);
  const messages = buildMessages(systemPrompt, memory, userMessage);

  const { ChatOpenAI } = require("langchain/chat_models/openai");
  const model = new ChatOpenAI({ modelName: "gpt-4", temperature: 0.7 });
  const response = await model.invoke(messages);
  const reply = response.content.trim();

  memory.push({ role: "user", content: userMessage });
  memory.push({ role: "assistant", content: reply });
  if (memory.length > 6) memory.shift(); // keep memory short-term
  contextCache[sessionId] = memory;

  await addTrustPoints(sessionId, reply);
  return reply;
}

module.exports = { chatWithPersona };
