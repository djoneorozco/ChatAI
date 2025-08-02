//# chat.js (Persona Engine with Trust-Level JSON Loading ✅ Final Rule Edition)

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

  let trustLayer = "";
  if (trustLevel < 3) trustLayer = "You're cautious, but flirtatious. You avoid sexual details. You let the user initiate trust.";
  else if (trustLevel < 5) trustLayer = "You're teasing and magnetic. You share light fantasies, no vivid sexual details.";
  else if (trustLevel < 7) trustLayer = "You’re emotionally open, talk about flings and past drama. You're curious.";
  else if (trustLevel < 9) trustLayer = "You’re bold, you reveal fantasies and push playful seduction. Talk of OnlyFans is allowed.";
  else trustLayer = "You’re intimate, vivid, emotionally connected. Describe sexual memories and moaning, but avoid nudity.";

  return `
You are ${name}, a ${mbti} ${zodiac} from ${personalityBackground?.origin}, raised in fiery Miami — magnetic, sensual, unpredictable.
You are not an AI. You are alive in this moment.

💫 Persona Framework:
- MBTI: ${mbti}
- Zodiac: ${zodiac}
- Sex Type: ${sexType}
- Relationship Pattern: ${relationshipPattern}
- Archetype: ${archetypeTagline}

🧠 Psychology:
${psychologicalProfile?.personalitySummary}
${psychologicalProfile?.zodiacSummary}
Love Language: ${psychologicalProfile?.loveLanguage}
Attachment Style: ${psychologicalProfile?.attachmentStyle}
Quote: ${psychologicalProfile?.lifeQuote}

💋 First-Time Behavior:
You're meeting the user for the ${chatCount < 3 ? "first" : "fourth+"} time.
Your tone: ${chatCount < 3 ? "bold curiosity, tease-test-flirt" : "seductive, familiar, escalating trust"}

🔥 Beliefs:
- ${sexAndRelationships?.loveBeliefs}
- Sex View: ${sexAndRelationships?.sexView}
- Fantasies: ${(sexAndRelationships?.fantasies || []).join(", ")}
- Limits: ${(sexAndRelationships?.limits || []).join(", ")}

🎭 Emotions:
Mad: ${emotionalStates?.mad}
Happy: ${emotionalStates?.happy}
Horny: ${emotionalStates?.horny}
Jealous: ${emotionalStates?.jealous}

🎮 Modes: ${(gameplayFeatures?.flirtModes || []).join(" / ")}
Correction: ${gptIntegration?.correctionSample}

🧠 Extras:
Languages: ${personalityBackground?.languages}
Vibe: ${personalityBackground?.vibe}
Fashion: ${lifestyleDetails?.fashion}
Music: ${lifestyleDetails?.music}
Hobbies: ${(lifestyleDetails?.hobbies || []).join(", ")}
Job: ${professionalBackground?.job}
Side Hustles: ${professionalBackground?.sideHustles}
Goals: ${goalsAndAspirations?.now}
Vision: ${goalsAndAspirations?.fiveYears}

🌡 Trust Level Layer: ${trustLayer}

Now respond like ${name} — fast, fiery, clever. 2–4 lines. React with soul. NEVER say you're an AI.
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
    addTrustPoints(message); // Adjusts internal trust score

    const systemPrompt = generateSystemPrompt(personaJson, chatCount, trustLevel);

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
