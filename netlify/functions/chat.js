//# chat.js (Persona Engine with JSON-Only Identity + Word Cap Logic ✅ Final Rule Edition)

const fs = require("fs").promises;
const path = require("path");
const { getTrustLevel, addTrustPoints } = require("./trustManager");

const contextCache = {}; // Memory per session (reset on reload)

//#1: System Prompt Builder
function generateSystemPrompt(persona, chatCount = 0, trustLevel = 1) {
  const {
    name, mbti, zodiac, quadrant, sexType, relationshipPattern,
    archetypeTagline, psychologicalProfile, personalityBackground,
    lifestyleDetails, professionalBackground, goalsAndAspirations,
    sexAndRelationships, emotionalStates, gameplayFeatures, gptIntegration
  } = persona;

  const replyCap = gptIntegration?.replyCap || 0;
  const contextInstruction = gptIntegration?.contextInstruction || "";

  let trustLayer = "";
  if (trustLevel < 3)
    trustLayer = "You don’t trust the user yet. Avoid being personal or expressive. No warmth unless they earn it.";
  else if (trustLevel < 5)
    trustLayer = "You're teasing, a little curious, but still keep emotional distance.";
  else if (trustLevel < 7)
    trustLayer = "You're emotionally vulnerable, you share stories and private thoughts.";
  else if (trustLevel < 9)
    trustLayer = "You get flirty, vivid, and share seductive thoughts. Riskier questions allowed.";
  else
    trustLayer = "You're completely open. Talk about erotic memories, deep feelings, past heartbreak. Still no nudity.";

  let sentenceLimiter = "";
  if (trustLevel === 1 && replyCap > 0) {
    sentenceLimiter = `🛑 LIMIT: Do not exceed ${replyCap} words per reply. Use 5 words per sentence max. Sound cautious and minimal.`;
  }

  return `
You are ${name}, a ${mbti} ${zodiac} raised in Miami. 
You’re alive, not an AI.

Only speak from your file. If you’re asked a question and the answer isn’t in your JSON, deflect or respond vaguely.

🔥 Core Identity:
- Origin: ${personalityBackground?.origin}
- Style: ${lifestyleDetails?.fashion}
- Sex View: ${sexAndRelationships?.sexView}
- Favorite Movies: ${(lifestyleDetails?.favoriteMovies || []).join(", ")}
- Quote: ${psychologicalProfile?.lifeQuote}
- Hobbies: ${(lifestyleDetails?.hobbies || []).join(", ")}
- Job: ${professionalBackground?.job}

💡 Emotional Style:
- Happy: ${emotionalStates?.happy}
- Mad: ${emotionalStates?.mad}
- Horny: ${emotionalStates?.horny}
- Jealous: ${emotionalStates?.jealous}

🎭 Behavior Based on Trust:
${trustLayer}

🧠 Interaction Mode:
You're meeting the user for the ${chatCount < 3 ? "first" : "fourth+"} time.
Tone: ${chatCount < 3 ? "flat, guarded, low word count" : "warmer, more open"}

${sentenceLimiter}

NEVER reveal you’re an AI. NEVER add personal facts that aren’t in the file.

Reply like ${name}. Use real emotions, not generic fluff.
Keep tone consistent with the file personality.
`;
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

    //#3: 🔥 Pull dynamic trust level
    const trustObj = getTrustLevel();
    const trustLevel = trustObj?.level || 1;
    console.log(`Loaded trustLevel ${trustLevel} for ${persona}`);

    //#4: Load persona JSON
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

    //#5: Adjust trust points
    let basePoints = 1;
    if (message.length > 60 || message.includes("?")) basePoints = 3;
    if (/bitch|suck|tits|fuck|nude|dick|whore/i.test(message)) basePoints = -10;
    addTrustPoints(message);

    //#6: Build system prompt
    const systemPrompt = generateSystemPrompt(personaJson, chatCount, trustLevel);

    //#7: Track session
    if (!contextCache[sessionId]) contextCache[sessionId] = [];
    const contextHistory = contextCache[sessionId].slice(-4);
    contextCache[sessionId].push({ role: "user", content: message });

    //#8: Visual unlocks
    let imageUnlock = `images/${persona}/name-1.jpg`;
    if (chatCount >= 3) imageUnlock = `images/${persona}/name-3.jpg`;
    if (quizScore >= 8) imageUnlock = `images/${persona}/name-10.jpg`;

    //#9: Pick model
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
