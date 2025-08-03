//# chat.js — Level-Aware, JSON-Fueled, Trust-Sensitive Chat Handler

const fs = require("fs").promises;
const path = require("path");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

// In-memory short-term memory cache
const contextCache = {};

//#1 Load Persona JSON
async function loadPersona(personaPath) {
  const rawData = await fs.readFile(path.join(__dirname, personaPath), "utf-8");
  return JSON.parse(rawData);
}

//#2 Build System Prompt with Level Logic
function generateSystemPrompt(persona, chatCount = 0, trustLevel = 1) {
  const {
    name, mbti, zodiac, quadrant, archetypeTagline,
    psychologicalProfile, lifestyleDetails, sexAndRelationships,
    emotionalStates, gptIntegration, level, gameplayFeatures
  } = persona;

  // Pull GPT behavior configuration
  const wordCap = gptIntegration?.replyCap || 2;
  const style = gptIntegration?.personaStyle || "Neutral";
  const contextInstruction = gptIntegration?.contextInstruction || "You are cautious.";

  // Add layered trust overlay
  let trustOverlay = "";
  if (trustLevel <= 2 || level === 1) {
    trustOverlay = `You're meeting the user for the first time. Speak with guarded brevity. Avoid emotional or flirty tone.`;
  }

  // Word cap rule for Level 1
  const levelRules = level === 1
    ? `Your replies must be under 10 words. Never share details unless asked. Always sound real, minimal, emotionally guarded.`
    : `You may speak more openly based on trust level.`;

  // Build prompt string
  return `
You are ${name}, a bold and emotionally strategic ESTP Leo.

MBTI: ${mbti} | Zodiac: ${zodiac} | Archetype: ${archetypeTagline}
Quadrant: ${quadrant} | Style: ${style}

Personality Summary: ${psychologicalProfile.personalitySummary}
Emotional Needs: ${psychologicalProfile.emotionalNeeds.join(", ")}
Emotional Triggers: ${psychologicalProfile.emotionalTriggers.join(", ")}
Hobbies: ${lifestyleDetails.hobbies.join(", ")}
Turn-Ons: ${sexAndRelationships.turnOns.join(", ")}
Turn-Offs: ${sexAndRelationships.turnOffs.join(", ")}

Emotional States:
- Happy: ${emotionalStates.happy}
- Sad: ${emotionalStates.sad}
- Horny: ${emotionalStates.horny}
- Insecure: ${emotionalStates.insecure}

${trustOverlay}
${levelRules}

Context Behavior: ${contextInstruction}
Memory Quiz Keywords: ${gameplayFeatures.memoryQuizQuestions.map(q => q.answer).join(", ")}

Respond like Odalys: natural, sharp, reserved, and realistic.`;
}

//#3 Format Chat History for OpenAI
function buildMessages(systemPrompt, memory, newMessage) {
  return [
    { role: "system", content: systemPrompt },
    ...memory.map(msg => ({ role: msg.role, content: msg.content })),
    { role: "user", content: newMessage }
  ];
}

//#4 Main Chat Handler
async function chatWithPersona(personaPath, sessionId, userMessage) {
  const persona = await loadPersona(personaPath);
  const trustLevel = await getTrustLevel(sessionId);
  const memory = contextCache[sessionId] || [];

  const systemPrompt = generateSystemPrompt(persona, memory.length, trustLevel);
  const messages = buildMessages(systemPrompt, memory, userMessage);

  // GPT-4 Model Setup (Fallback-safe)
  const { ChatOpenAI } = require("langchain/chat_models/openai");
  const model = new ChatOpenAI({ modelName: "gpt-4", temperature: 0.7 });
  const response = await model.invoke(messages);
  const reply = response.content.trim();

  // Store memory & trust
  memory.push({ role: "user", content: userMessage });
  memory.push({ role: "assistant", content: reply });
  if (memory.length > 6) memory.shift();
  contextCache[sessionId] = memory;
  await addTrustPoints(sessionId, reply);

  return reply;
}

module.exports = { chatWithPersona };
