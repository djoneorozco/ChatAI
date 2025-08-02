//# chatHandler.js (Simplified with 10-Level Personality Loader)

const fs = require("fs").promises;
const path = require("path");
const {
  getTrustLevel,
  addTrustPoints,
  forceTrustLevel,
} = require("./trustManager");

const contextCache = {}; // Basic 3-turn memory

//#1: Lambda Chat Handler
exports.handler = async (event) => {
  try {
    if (!event.body)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No input provided." }),
      };

    const {
      message,
      persona = "odalys",
      chatCount = 0,
      sessionId = "anon",
    } = JSON.parse(event.body);

    if (!message)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message is empty." }),
      };

    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    if (!OPENROUTER_KEY || !OPENAI_KEY)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing API key(s)." }),
      };

    if (!/^[a-z0-9-_]+$/i.test(persona))
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid persona name." }),
      };

    //#2: Trust Points Update
    let basePoints = 1;
    if (message.toLowerCase().includes("nextlevel")) {
      await forceTrustLevel(persona, 5);
    } else {
      if (message.length > 60 || message.includes("?")) basePoints = 3;
      if (/bitch|suck|tits|fuck|nude|dick|whore/i.test(message)) basePoints = -10;
      await addTrustPoints(basePoints, persona);
    }

    const trustScore = await getTrustLevel(persona);
    const level = Math.min(10, Math.max(1, Math.ceil(trustScore / 10)));

    const personaPath = path.join(
      __dirname,
      "personas",
      persona,
      `level-${level}.json`
    );
    const personaData = await fs.readFile(personaPath, "utf-8");
    const personaJson = JSON.parse(personaData);

    //#3: System Prompt (already embedded into file)
    const systemPrompt = personaJson.systemPrompt || "You are the persona.";

    //#4: Chat Context
    if (!contextCache[sessionId]) contextCache[sessionId] = [];
    const contextHistory = contextCache[sessionId].slice(-4);
    contextCache[sessionId].push({ role: "user", content: message });

    //#5: Image Unlock
    const imageUnlock = personaJson.imageUnlock || null;

    //#6: Model Routing
    let apiUrl, headers, bodyPayload;
    const messages = [
      { role: "system", content: systemPrompt },
      ...contextHistory,
      { role: "user", content: message },
    ];

    if (trustScore <= 20) {
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

    //#7: GPT Call
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
      body: JSON.stringify({ reply, imageUnlock, trustLevel: trustScore }),
    };
  } catch (err) {
    console.error("Handler Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error: " + err.message }),
    };
  }
};
