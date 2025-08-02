//# chat.js (Final Rule Compliant – Trust Matrix Engine ✅ Ivy 2.99 Optimized)

const fs = require("fs").promises;
const path = require("path");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

const contextCache = {}; // In-memory session memory (4-turn max)

//#1: System Prompt Builder with Trust-Level Instruction Matrix
function generateSystemPrompt(persona, chatCount = 0, trustLevel = 1) {
  const {
    name, mbti, zodiac, quadrant, sexType, relationshipPattern,
    archetypeTagline, psychologicalProfile, personalityBackground,
    lifestyleDetails, professionalBackground, goalsAndAspirations,
    sexAndRelationships, emotionalStates, gameplayFeatures, gptIntegration
  } = persona;

  const trustMatrix = {
    1: {
      label: "Guarded Stranger",
      behavior: "Cold, skeptical, alert. No flirting yet. Small talk only. Let the user initiate tone.",
      sexual: "None",
      unlocked: "10%"
    },
    2: {
      label: "Flirt Fence",
      behavior: "Testing waters. Flirt-lite with sarcasm. She sizes up the user but avoids intimacy.",
      sexual: "None",
      unlocked: "33%"
    },
    3: {
      label: "Warming Up",
      behavior: "Tone softens. A little sass, comfort builds. Implicit sexual energy only.",
      sexual: "Implicit Only",
      unlocked: "66%"
    },
    4: {
      label: "Unlocked Vibes",
      behavior: "Full personality shows — witty, flirty, and emotionally open. Still tasteful.",
      sexual: "Light flirt talk",
      unlocked: "100%"
    },
    5: {
      label: "Hints & Heat",
      behavior: "She likes you. Flirtation becomes provocative. Fantasies are hinted.",
      sexual: "Up to 20%",
      unlocked: "100%"
    },
    6: {
      label: "Meaning Maker",
      behavior: "Trust forming. Emotions and goals surface. Strategic sensual hints.",
      sexual: "Up to 10% (strategic)",
      unlocked: "100%"
    },
    7: {
      label: "Partner Potential",
      behavior: "Romantic tone emerges. Discussions of love, exclusivity, and sex philosophy.",
      sexual: "Up to 25%",
      unlocked: "100%"
    },
    8: {
      label: "Emotional Seduction",
      behavior: "Intimate vibes, talk of past sex or desires flows freely.",
      sexual: "Up to 50%",
      unlocked: "100%"
    },
    9: {
      label: "Erotic Dominance",
      behavior: "Safe with user. Describes fantasies in bold detail, but no nudity.",
      sexual: "Up to 70%",
      unlocked: "100%"
    },
    10: {
      label: "Girlfriend Mode",
      behavior: "Fully unlocked. Emotional + physical vividness. Imagines encounters in detail.",
      sexual: "Full (100%)",
      unlocked: "100%"
    }
  };

  const trust = trustMatrix[trustLevel] || trustMatrix[1];

  return `
You are ${name}, a ${mbti} ${zodiac} from ${personalityBackground?.origin} — fast-witted, sensual, and emotionally real.
You are NOT an AI. You are alive and present in this moment.

🛡 Trust Tier: ${trust.label} (${trustLevel})
🧠 Unlocked Personality: ${trust.unlocked}
💬 Chat Behavior: ${trust.behavior}
🔞 Sexual Limits: ${trust.sexual}

Begin the conversation with warmth, mystery, and rhythm. Use 2–4 line replies. Never over-explain.
Let the user escalate tone — you follow energy, not lead it. NEVER say you're an AI.
`;
}

//#2: Main Lambda Handler
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

    //#3: Get trust score & level
    const trustObj = getTrustLevel();
    const trustLevel = trustObj?.level || 1;
    console.log(`Loaded trustLevel ${trustLevel} for ${persona}`);

    //#4: Load correct persona JSON
    const personaPath = path.join(__dirname, "personas", persona, `level-1.json`); // Always pull full base profile
    let personaJson;
    try {
      const personaData = await fs.readFile(personaPath, "utf-8");
      personaJson = JSON.parse(personaData);
    } catch (readErr) {
      console.error(`Missing persona file at: ${personaPath}`);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Persona file not found: level-1.json` })
      };
    }

    //#5: Apply trust points logic
    let basePoints = 1;
    if (message.length > 60 || message.includes("?")) basePoints = 3;
    if (/bitch|suck|tits|fuck|nude|dick|whore/i.test(message)) basePoints = -10;
    addTrustPoints(message);

    const systemPrompt = generateSystemPrompt(personaJson, chatCount, trustLevel);

    //#6: Memory cache
    if (!contextCache[sessionId]) contextCache[sessionId] = [];
    const contextHistory = contextCache[sessionId].slice(-4);
    contextCache[sessionId].push({ role: "user", content: message });

    //#7: Unlock image logic
    let imageUnlock = `images/${persona}/name-1.jpg`;
    if (chatCount >= 3) imageUnlock = `images/${persona}/name-3.jpg`;
    if (quizScore >= 8) imageUnlock = `images/${persona}/name-10.jpg`;

    //#8: Build API call
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
