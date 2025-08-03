//# chat.js – Netlify Lambda: dynamic persona + trust + memory + OpenAI

const fs   = require("fs").promises;
const path = require("path");
const fetch = require("node-fetch"); // or global fetch in newer runtimes
const { getTrustLevel, updateTrust } = require("./trustManager");

// very short in-memory memory per session
const contextCache = {};  // { [sessionId]: [ {role,content}, … ] }

async function loadPersona(level, name = "odalys") {
  const file = `level-${level}.json`;
  const full = path.join(__dirname, "personas", name, file);
  const raw  = await fs.readFile(full, "utf-8");
  return JSON.parse(raw);
}

function buildSystemPrompt(p, chatCount, trustLevel) {
  // you can adapt this to pull more fields if you like
  return `
You are ${p.name} (MBTI: ${p.mbti}, ${p.zodiac}), level ${trustLevel} persona.

Tone rules:
- ${p.gptIntegration.contextInstruction || "Speak cautiously until trust grows."}
- Max ${p.gptIntegration.replyCap || 10} words.

Background:
${p.psychologicalProfile.personalitySummary}

Hobbies: ${p.lifestyleDetails.hobbies.join(", ")}
First impression voice: ${p.psychologicalProfile.firstImpressionVoice}

When you reply, keep it under ${p.gptIntegration.replyCap||10} words.
`;
}

exports.handler = async (event) => {
  try {
    const sessionId = event.headers["x-session-id"] || "anon";
    const { message: userMsg = "" } = JSON.parse(event.body||"{}");

    if (!userMsg.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "No message." }) };
    }

    // 1) bump/penalize trust
    updateTrust(sessionId, userMsg);
    const trustLevel = getTrustLevel(sessionId);

    // 2) load the JSON for that level
    const persona = await loadPersona(trustLevel, "odalys");

    // 3) build your system prompt
    const chatCount = (contextCache[sessionId]||[]).filter(m=>m.role==="user").length;
    const systemPrompt = buildSystemPrompt(persona, chatCount, trustLevel);

    // 4) assemble messages
    const memory = contextCache[sessionId] = contextCache[sessionId]||[];
    const history = memory.slice(-6);
    const messages = [
      { role: "system",  content: systemPrompt },
      ...history,
      { role: "user",    content: userMsg }
    ];

    // 5) call OpenAI
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({
        model:       "gpt-4",
        messages,
        max_tokens: 150,
        temperature: 0.7
      })
    });
    const { choices } = await res.json();
    const reply = choices?.[0]?.message?.content?.trim() || "(… )";

    // 6) update memory
    memory.push({ role: "user",      content: userMsg });
    memory.push({ role: "assistant", content: reply });

    // 7) return
    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel })
    };

  } catch (err) {
    console.error("💥 chat.js error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
