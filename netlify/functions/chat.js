//# chat.js – Clean Netlify Function using OpenAI SDK, JSON Persona, Trust + Memory
const fs = require("fs").promises;
const path = require("path");
const { Configuration, OpenAIApi } = require("openai");
const { getTrustLevel } = require("./trustManager"); // ✅ You confirmed this exists

// Short-term memory per session (in-memory)
const contextCache = {};

//#1 Load Persona JSON Dynamically by Trust Level
async function loadPersona(level = 1, name = "odalys") {
  const fileName = `level-${level}.json`;
  const filePath = path.join(__dirname, "personas", name, fileName);
  const rawData = await fs.readFile(filePath, "utf-8");
  return JSON.parse(rawData);
}

//#2 Generate System Prompt
function buildSystemPrompt(persona) {
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

  const style = gptIntegration?.personaStyle || "Reserved";
  const cap = gptIntegration?.replyCap || 10;

  return `
You are ${name}, an emotionally intelligent AI persona.
MBTI: ${mbti}, Zodiac: ${zodiac}, Archetype: ${archetypeTagline}, Quadrant: ${quadrant}

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

Rules:
- You are cautious. Speak very little at first.
- Never flirt yet.
- Max ${cap} words per reply. No exceptions.
- Ask short follow-ups like: "You?", "Why?", "When?"
- Sound ${style.toLowerCase()}, curious, emotionally controlled.
`;
}

//#3 OpenAI Call
async function getOpenAIReply(systemPrompt, memory, userInput) {
  const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
  const openai = new OpenAIApi(configuration);

  const messages = [
    { role: "system", content: systemPrompt },
    ...memory,
    { role: "user", content: userInput }
  ];

  const completion = await openai.createChatCompletion({
    model: "gpt-4",
    temperature: 0.7,
    messages
  });

  return completion.data.choices[0].message.content.trim();
}

//#4 Main Lambda Handler
exports.handler = async (event) => {
  try {
    const sessionId = event.headers["x-session-id"] || "default";
    const body = JSON.parse(event.body || "{}");
    const userMessage = body.message || "";
    const personaName = "odalys";

    const trustLevel = await getTrustLevel(sessionId, personaName); // 🔐 Pull trust
    const persona = await loadPersona(trustLevel, personaName);     // ✅ Load correct level
    const systemPrompt = buildSystemPrompt(persona);

    if (!contextCache[sessionId]) contextCache[sessionId] = [];

    const memory = contextCache[sessionId].slice(-6); // keep memory short

    const reply = await getOpenAIReply(systemPrompt, memory, userMessage);

    memory.push({ role: "user", content: userMessage });
    memory.push({ role: "assistant", content: reply });
    contextCache[sessionId] = memory;

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    console.error("Fatal chat.js error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chat handler crashed", details: err.message })
    };
  }
};
