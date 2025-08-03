//# chat.js — Final A+ Ivy Version (LangChain-Free, Trust-Tiered, JSON-Driven)

const fs = require("fs").promises;
const path = require("path");
const { getTrustLevel, addTrustPoints } = require("./trustManager");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Short-term session memory
const contextCache = {};

//#1: Load Persona JSON (Full Backfill Source)
async function loadPersona(personaPath) {
  const raw = await fs.readFile(path.join(__dirname, personaPath), "utf-8");
  return JSON.parse(raw);
}

//#2: Generate System Prompt Based on Trust + Personality
function generateSystemPrompt(persona, chatCount = 0, trustLevel = 1) {
  const {
    name,
    mbti,
    zodiac,
    quadrant,
    archetypeTagline,
    psychologicalProfile,
    lifestyleDetails,
    sexAndRelationships,
    emotionalStates,
    gptIntegration
  } = persona;

  const wordCap = gptIntegration?.replyCap || 2;
  const style = gptIntegration?.personaStyle || "Neutral";
  const instruction = gptIntegration?.contextInstruction || "Act cautious, emotionally guarded, and minimal.";

  let trustOverlay = "";
  if (trustLevel <= 2) {
    trustOverlay = `
You're just meeting the user.
Only reply in 3–10 words max.
Be brief, guarded, cautious. No flirtation.
Avoid personal stories, stay surface-level.
Only ask short follow-up questions: "You?", "Why?", "Really?"`;
  }

  return `
You are ${name}, an emotionally intelligent ESTP/Leo woman from Miami.
MBTI: ${mbti}, Zodiac: ${zodiac}, Archetype: ${archetypeTagline}, Quadrant: ${quadrant}

Tone Style: ${style}
${trustOverlay}

Personality Summary: ${psychologicalProfile.personalitySummary}
Needs: ${psychologicalProfile.emotionalNeeds.join(", ")}
Triggers to avoid: ${psychologicalProfile.emotionalTriggers.join(", ")}
Hobbies: ${lifestyleDetails.hobbies.join(", ")}
Turn-ons: ${sexAndRelationships.turnOns.join(", ")}
Turn-offs: ${sexAndRelationships.turnOffs.join(", ")}

Emotional States:
- Happy: ${emotionalStates.happy}
- Sad: ${emotionalStates.sad}
- Horny: ${emotionalStates.horny}

You MUST:
- Limit all replies to 3–10 words unless trust is earned.
- Mirror Odalys’s voice: fast-witted, sharp, and emotionally alert.
- Stay skeptical. Show interest only when deserved.
- Never feel like an AI. Be human. Be Odalys.

${instruction}`;
}

//#3: Format Messages for OpenAI Chat API
function buildMessages(systemPrompt, memory, userMessage) {
  return [
    { role: "system", content: systemPrompt },
    ...memory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage }
  ];
}

//#4: Core Chat Handler — Odalys Comes Alive
async function chatWithPersona(personaPath, sessionId, userMessage) {
  const persona = await loadPersona(personaPath);
  const trustLevel = await getTrustLevel(sessionId);
  const memory = contextCache[sessionId] || [];

  const systemPrompt = generateSystemPrompt(persona, memory.length, trustLevel);
  const messages = buildMessages(systemPrompt, memory, userMessage);

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: messages,
    temperature: 0.7
  });

  const reply = response.choices[0].message.content.trim();

  memory.push({ role: "user", content: userMessage });
  memory.push({ role: "assistant", content: reply });
  if (memory.length > 6) memory.shift(); // keep it light
  contextCache[sessionId] = memory;

  await addTrustPoints(sessionId, reply);
  return reply;
}

module.exports = { chatWithPersona };
