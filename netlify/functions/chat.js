//# chat.js (Persona Engine with Trust-Level JSON Loading ✅ Final Rule Edition)

const fs = require("fs").promises;
const path = require("path");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

const contextCache = {}; // Memory per session (reset on reload)

//#1: System Prompt Builder (JSON-Controlled Only)
function generateSystemPrompt(persona) {
  if (persona?.gptIntegration?.contextInstruction) {
    return persona.gptIntegration.contextInstruction;
  } else {
    return `You are ${persona.name}, but no contextInstruction was found in the JSON. Please speak cautiously.`;
  }
}

//#2: Lambda Handler
exports.handler = async (event) => {
  try {
    if (!event.body)
      return { statusCode: 400, body: JSON.stringify({ error: "No input provided." }) };

    const {
      message,
      persona = "odalys",
      chatCount = 0,
      quizScore = 0,
      sessionId = "anon"
    } = JSON.parse(event.body);

    if (!message)
      return { statusCode: 400, body: JSON.stringify({ error: "Message is empty." }) };

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENAI_KEY || !OPENROUTER_KEY)
      return { statusCode: 500, body: JSON.stringify({ error: "Missing API keys." }) };

    if (!/^[a-z0-9-_]+$/i.test(persona))
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid persona name." }) };

    //#3: 🔥 Pull dynamic trust level (with safety fallback)
    const trustObj = getTrustLevel();
    const trustLevel = trustObj?.level || 1;
    console.log(`Loaded trustLevel ${trustLevel} for ${persona}`);

    //#4: Load correct persona JSON safely
    const personaPath = path.join(__dirname, "personas", persona, `level-${trustLevel}.json`);
    let personaJson;
    try {
      const personaData = await fs.readFile(personaPath, "utf-8");
      personaJson = JSON.parse(personaData);
    } catch (readErr) {
      console.error(`Missing persona file at: ${personaPath}`);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Persona file not found: level-${trustLevel}.json` })
      };
    }

    //#5: Trust boost
    let basePoints = 1;
    if (message.length > 60 || message.includes("?")) basePoints = 3;
    if (/bitch|suck|tits|fuck|nude|dick|whore/i.test(message)) basePoints = -10;
    addTrustPoints(message);

    const systemPrompt = generateSystemPrompt(personaJson);

    //#6: Session context
    if (!contextCache[sessionId]) contextCache[sessionId] = [];
    const contextHistory = contextCache[sessionId].slice(-4);
    contextCache[sessionId].push({ role: "user", content: message });

    //#7: Image Unlock Logic
    let imageUnlock = `images/${persona}/name-1.jpg`;
    if (chatCount >= 3) imageUnlock = `images/${persona}/name-3.jpg`;
    if (quizScore >= 8) imageUnlock = `images/${persona}/name-10.jpg`;

    //#8: Choose model
    const messages = [
      { role: "system", content: systemPrompt },
      ...contextHistory,
      { role: "user", content: message }
    ];

    let apiUrl, headers, payload;
    if (trustLevel <= 2) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      headers = { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" };
      payload = { model: "gpt-4-1106-preview", messages, max_tokens: 150 };
    } else {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      headers = { Authorization: `Bearer ${OPENROUTER_KEY}`, "Content-Type": "application/json" };
      payload = { model: "gryphe/mythomax-l2-13b", messages, max_tokens: 150 };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "(No reply from model)";
    contextCache[sessionId].push({ role: "assistant", content: reply });

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, imageUnlock, trustLevel })
    };
  } catch (err) {
    console.error("Handler Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error: " + err.message })
    };
  }
};
