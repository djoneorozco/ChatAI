//# chatHandler.js (Fixed image path + trust passphrase logic)

const fs = require("fs").promises;
const path = require("path");
const {
  getTrustLevel,
  addTrustPoints,
} = require("./trustManager");

const contextCache = {}; // In-memory cache for 3-turn memory per user session (basic)

function generateSystemPrompt(persona, chatCount = 0, trustLevel = 1) {
  const {
    name,
    mbti,
    zodiac,
    psychologicalProfile,
    personalityBackground,
    lifestyleDetails,
    professionalBackground,
  } = persona;

  let trustLayer = "";

  switch (trustLevel) {
    case 1:
      trustLayer = `🚧 LEVEL 1 TRUST BARRIER — FIRST MEETING RULESET 🚧 ...`; break;
    case 2: trustLayer = "You're respectful but lightly curious..."; break;
    case 3: trustLayer = "You're gently curious..."; break;
    case 4: trustLayer = "You're open to friendly conversation..."; break;
    case 5: trustLayer = "You're now lightly flirtatious..."; break;
    case 6: trustLayer = "You're confident and witty..."; break;
    case 7: trustLayer = "You're emotionally available and teasing..."; break;
    case 8: trustLayer = "You're bold, emotionally present, and seductive..."; break;
    case 9: trustLayer = "You're deeply magnetic..."; break;
    case 10: trustLayer = "You're intensely intimate and emotionally raw..."; break;
    default: trustLayer = "You are cautiously interested, but emotionally measured.";
  }

  const safeSummary = `
You are ${name}, a ${mbti} ${zodiac} from ${personalityBackground?.origin}, raised in Miami.
You're meeting the user for the ${chatCount < 3 ? "first time" : "fourth+ time"}.

Your tone: ${chatCount < 3 ? "interested, calm and respectful" : "witty, flirt-forward"}.
Style: emotionally intelligent, conversational, 2–4 lines only.

🌡 Trust Layer: ${trustLayer}
`;

  return safeSummary;
}

//# Lambda Handler
exports.handler = async (event) => {
  try {
    if (!event.body) return { statusCode: 400, body: JSON.stringify({ error: "No input provided." }) };

    const {
      message,
      persona = "odalys",
      chatCount = 0,
      quizScore = 0,
      sessionId = "anon",
    } = JSON.parse(event.body);

    if (!message) return { statusCode: 400, body: JSON.stringify({ error: "Message is empty." }) };

    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    if (!OPENROUTER_KEY || !OPENAI_KEY)
      return { statusCode: 500, body: JSON.stringify({ error: "Missing API key(s)." }) };

    if (!/^[a-z0-9-_]+$/i.test(persona))
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid persona name." }) };

    const personaPath = path.join(__dirname, "personas", `${persona}.json`);
    const personaData = await fs.readFile(personaPath, "utf-8");
    const personaJson = JSON.parse(personaData);

    //# Trust Points Logic (with secret phrase!)
    let basePoints = 1;
    if (message.toLowerCase().includes("deepthroat")) basePoints = 1000; // 🚀 boost
    else {
      if (message.length > 60 || message.includes("?")) basePoints = 3;
      if (/bitch|suck|tits|fuck|nude|dick|whore/i.test(message)) basePoints = -10;
    }

    await addTrustPoints(basePoints, persona);
    const trustLevel = await getTrustLevel(persona);

    const systemPrompt = generateSystemPrompt(personaJson, chatCount, trustLevel);

    //# Memory Cache
    if (!contextCache[sessionId]) contextCache[sessionId] = [];
    const contextHistory = contextCache[sessionId].slice(-4);
    contextCache[sessionId].push({ role: "user", content: message });

    //# Correct image path logic
    const trustImageLevel = Math.max(1, Math.min(10, trustLevel));
    let imageUnlock = `images/${persona}-${trustImageLevel}.jpg`;

    //# Model Switching
    let apiUrl, headers, bodyPayload;

    const messages = [
      { role: "system", content: systemPrompt },
      ...contextHistory,
      { role: "user", content: message },
    ];

    if (trustLevel <= 2) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      headers = {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      };
      bodyPayload = {
        model: "gpt-4-1106-preview",
        messages,
        max_tokens: 150,
      };
    } else {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      headers = {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      };
      bodyPayload = {
        model: "gryphe/mythomax-l2-13b",
        messages,
        max_tokens: 150,
      };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "(No reply)";
    contextCache[sessionId].push({ role: "assistant", content: reply });

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, imageUnlock, trustLevel }),
    };
  } catch (err) {
    console.error("Handler Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error: " + err.message }),
    };
  }
};
