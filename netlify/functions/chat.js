//# chat.js — Clean Version: No LangChain, Full Persona Logic, Level-1 Ready

const fs = require("fs").promises;
const path = require("path");
const { Configuration, OpenAIApi } = require("openai");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

const contextCache = {};

//#1 Load Persona from JSON
async function loadPersona(personaPath) {
  const fullPath = path.join(__dirname, personaPath);
  const raw = await fs.readFile(fullPath, "utf-8");
  return JSON.parse(raw);
}

//#2 Generate System Prompt
function generateSystemPrompt(persona, trustLevel = 1) {
  const {
    name, mbti, zodiac, quadrant, archetypeTagline,
    psychologicalProfile, lifestyleDetails, sexAndRelationships,
    emotionalStates, gptIntegration
  } = persona;

  const style = gptIntegration?.personaStyle || "Guarded";
  const wordCap = trustLevel <= 2 ? 10 : 30; // We'll soft-enforce this later
  const trustOverlay = trustLevel <= 2
    ? `You're just meeting the user. Odalys doesn’t overshare. Replies must be under 10 words.`
    : `You trust the user more now. Speak more freely.`;

  return `
You are ${name}, an emotionally sharp and bold ESTP/Leo woman.
MBTI: ${mbti}, Zodiac: ${zodiac}, Archetype: ${archetypeTagline}, Quadrant: ${quadrant}

Tone Style: ${style}
${trustOverlay}

Key Traits:
- Summary: ${psychologicalProfile.personalitySummary}
- Triggers: ${psychologicalProfile.emotionalTriggers.join(", ")}
- Needs: ${psychologicalProfile.emotionalNeeds.join(", ")}
- Hobbies: ${lifestyleDetails.hobbies.join(", ")}
- Turn-ons: ${sexAndRelationships.turnOns.join(", ")}
- Turn-offs: ${sexAndRelationships.turnOffs.join(", ")}

Emotional States:
- Happy: ${emotionalStates.happy}
- Sad: ${emotionalStates.sad}
- Horny: ${emotionalStates.horny}

Instructions:
- Respond in Odalys's voice.
- Trust level is ${trustLevel}.
- Until trust > 2, speak in short sentences (3–10 words).
- Do not flirt yet.
- Ask only short follow-up questions like "You?" or "Why?"
  `.trim();
}

//#3 Format Messages for OpenAI
function formatMessages(systemPrompt, memory, newMessage) {
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

  const systemPrompt = generateSystemPrompt(persona, trustLevel);
  const messages = formatMessages(systemPrompt, memory, userMessage);

  const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
  const openai = new OpenAIApi(configuration);

  const completion = await openai.createChatCompletion({
    model: "gpt-4",
    temperature: 0.7,
    messages
  });

  let reply = completion.data.choices[0].message.content.trim();

  // Soft enforcement of word limit if trust is low
  if (trustLevel <= 2) {
    const wordCount = reply.split(/\s+/).length;
    if (wordCount > 10) {
      const cut = reply.split(" ").slice(0, 10).join(" ") + "...";
      reply = cut;
    }
  }

  memory.push({ role: "user", content: userMessage });
  memory.push({ role: "assistant", content: reply });
  contextCache[sessionId] = memory.slice(-6); // cap memory

  await addTrustPoints(sessionId, reply);
  return reply;
}

module.exports = { chatWithPersona };
