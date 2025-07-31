//# chatHandler.js (Enhanced with Persona-Aware Trust + 3-Turn Memory + Safer I/O)

const fs = require("fs").promises;
const path = require("path");
const {
  getTrustLevel,
  addTrustPoints,
} = require("./trustManager");

const contextCache = {}; // In-memory cache for 3-turn memory per user session (basic)

//#1: Dynamic System Prompt Builder
function generateSystemPrompt(persona, chatCount = 0, trustLevel = 1) {
  const {
    name,
    mbti,
    zodiac,
    quadrant,
    sexType,
    relationshipPattern,
    archetypeTagline,
    psychologicalProfile,
    personalityBackground,
    lifestyleDetails,
    professionalBackground,
    goalsAndAspirations,
    sexAndRelationships,
    firstTimeStory,
    emotionalStates,
    gameplayFeatures,
    gptIntegration,
  } = persona;

  let trustLayer = "";
  if (trustLevel < 3) {
    trustLayer = "You're cautious but fun. You avoid flirt escalation. Ask about the user and only share a little about yourself.";
  } else if (trustLevel < 5) {
    trustLayer = "You're teasing and magnetic. You share light fantasies, no vivid sexual details.";
  } else if (trustLevel < 7) {
    trustLayer = "You’re emotionally open, talk about flings and past drama. You're curious.";
  } else if (trustLevel < 9) {
    trustLayer = "You’re bold, you reveal fantasies and push playful seduction. Talk of OnlyFans is allowed.";
  } else {
    trustLayer = "You’re intimate, vivid, emotionally connected. Describe sexual memories and moaning, but avoid nudity.";
  }

  // 🔒 Limit info if low trust
  const safeSummary = `
You are ${name}, a ${mbti} ${zodiac} from ${personalityBackground?.origin}, raised in Miami.
You're meeting the user for the ${chatCount < 3 ? "first time" : "fourth+ time"}.
Your tone is: ${chatCount < 3 ? "curious, light, interested in the user more than yourself" : "more familiar, playful, starting to tease"}
Your style: warm, soulful, emotionally intelligent.

Ask more than you tell. No vivid details. Let the user open up.
If you're asked about something personal, answer playfully but stay surface-level.
No deep fantasies or erotic stories unless trustLevel > 4.`;

  // 🧠 Prompt layering
  const fullPrompt = `
${safeSummary}

🧠 Psychology: ${psychologicalProfile?.personalitySummary || ""}
Hobbies: ${(lifestyleDetails?.hobbies || []).slice(0, 2).join(", ")} | Job: ${professionalBackground?.job}

🌡 Trust Level Layer: ${trustLayer}
React with emotion, keep it brief — 2–4 lines. Avoid over-sharing.`;

  return fullPrompt;
}

//#2: Lambda Chat Handler
exports.handler = async (event) => {
  try {
    if (!event.body) return { statusCode: 400, body: JSON.stringify({ error: "No input provided." }) };
    const { message, persona = "odalys", chatCount = 0, quizScore = 0, sessionId = "anon" } = JSON.parse(event.body);

    if (!message) return { statusCode: 400, body: JSON.stringify({ error: "Message is empty." }) };

    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_KEY) return { statusCode: 500, body: JSON.stringify({ error: "Missing OpenRouter key." }) };

    if (!/^[a-z0-9-_]+$/i.test(persona)) return { statusCode: 400, body: JSON.stringify({ error: "Invalid persona name." }) };

    const personaPath = path.join(__dirname, "personas", `${persona}.json`);
    const personaData = await fs.readFile(personaPath, "utf-8");
    const personaJson = JSON.parse(personaData);

    //#3: Trust Points Calculation
    let basePoints = 1;
    if (message.length > 60 || message.includes("?")) basePoints = 3;
    if (/bitch|suck|tits|fuck|nude|dick|whore/i.test(message)) basePoints = -10;

    await addTrustPoints(basePoints, persona);
    const trustLevel = await getTrustLevel(persona);

    const systemPrompt = generateSystemPrompt(personaJson, chatCount, trustLevel);

    //#4: Message Context Memory (basic session memory)
    if (!contextCache[sessionId]) contextCache[sessionId] = [];
    const contextHistory = contextCache[sessionId].slice(-4);
    contextCache[sessionId].push({ role: "user", content: message });

    //#5: Image Unlock Logic
    let imageUnlock = `images/${persona}/name-1.jpg`;
    if (chatCount >= 3) imageUnlock = `images/${persona}/name-3.jpg`;
    if (quizScore >= 8) imageUnlock = `images/${persona}/name-10.jpg`;

    //#6: API Request
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gryphe/mythomax-l2-13b",
        messages: [
          { role: "system", content: systemPrompt },
          ...contextHistory,
          { role: "user", content: message }
        ],
        max_tokens: 150,
      }),
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "(No reply from model)";
    contextCache[sessionId].push({ role: "assistant", content: reply });

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, imageUnlock, trustLevel }),
    };
  } catch (err) {
    console.error("Handler Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Server Error: " + err.message }) };
  }
};
