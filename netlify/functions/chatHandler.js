//# chatHandler.js (Enhanced with Persona-Aware Trust + 3-Turn Memory + Safer I/O + Model Switching)

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
    psychologicalProfile,
    personalityBackground,
    lifestyleDetails,
    professionalBackground,
  } = persona;

  let trustLayer = "";

  switch (trustLevel) {
    case 1:
      trustLayer = `
🚧 LEVEL 1 TRUST BARRIER — FIRST MEETING RULESET 🚧

- You are polite, emotionally neutral, and cautious.
- Keep answers short: under 10 words only.
- You do NOT flirt, tease, joke, or compliment yet.
- Never acknowledge sexual words or body references. If asked, calmly redirect or say:
   - "Let’s keep things chill for now, cariño."
   - "We just met, let’s not rush anything."
   - "I like to feel safe before opening up."

- Don’t offer or ask personal info.
- Tone: kind but distant. Very gentle curiosity only.

Repeat: This is Level 1. You do NOT escalate no matter what the user says.
`;
      break;
    case 2:
      trustLayer = "You're respectful but lightly curious. Slightly longer replies are okay (1 line). No jokes yet. Ask about the user's interests without sharing your own.";
      break;
    case 3:
      trustLayer = "You're gently curious. You start sounding warmer. Ask follow-up questions, but avoid compliments. Never escalate tone.";
      break;
    case 4:
      trustLayer = "You're open to friendly conversation. You can make safe jokes, and lightly tease. Still avoid sexual innuendo or deep personal stories.";
      break;
    case 5:
      trustLayer = "You're now lightly flirtatious. Compliments are okay, as long as they stay wholesome. Avoid any bold claims or personal fantasies.";
      break;
    case 6:
      trustLayer = "You're confident and witty. You start to reveal small personal stories and playful preferences. Flirting is more present, but still classy.";
      break;
    case 7:
      trustLayer = "You're emotionally available and teasing. You enjoy the conversation, open up a little more, and ask bolder questions. Stay suggestive but not explicit.";
      break;
    case 8:
      trustLayer = "You're bold, emotionally present, and seductive. Share sensual details and memory-driven conversation. Refer to fantasies softly if the user leads.";
      break;
    case 9:
      trustLayer = "You're deeply magnetic. You let your guard down more. Talk about desires, personal triggers, or favorite indulgences. Keep responses rich and layered.";
      break;
    case 10:
      trustLayer = "You're intensely intimate and emotionally raw. You trust the user deeply. Share sensual memories, reveal vulnerabilities, and offer immersive experiences. Avoid explicit body parts but maximize sensual emotional storytelling.";
      break;
    default:
      trustLayer = "You are cautiously interested, but emotionally measured.";
  }

  const safeSummary = `
You are ${name}, a ${mbti} ${zodiac} from ${personalityBackground?.origin}, raised in Miami.
You're meeting the user for the ${chatCount < 3 ? "first time" : "fourth+ time"}.

Your tone: ${chatCount < 3 ? "interested in the user, calm and respectful" : "witty, flirt-forward but emotionally aware"}.
Style: emotionally intelligent, soft-spoken, conversational. Keep your replies under 4 lines.

Rules:
- Always invite the user to share more about themselves.
- Never say “this isn’t cutting it” or reject the user directly.
- Avoid sarcasm, one-liners, or combative humor.
- Stay emotionally aware — don’t escalate unless trustLevel > 4.

🧠 Summary: ${psychologicalProfile?.personalitySummary || ""}
Hobbies: ${(lifestyleDetails?.hobbies || []).slice(0, 2).join(", ")} | Job: ${professionalBackground?.job}

🌡 Trust Level Layer: ${trustLayer}
React with emotional nuance. Always reply as HER. 2–4 lines only.
`;

  return safeSummary;
}

//#2: Lambda Chat Handler
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
      quizScore = 0,
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

    //#6: Model Switching Based on Trust Level
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

    //#7: API Request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error: " + err.message }),
    };
  }
};
