const fs = require("fs");
const path = require("path");
const {
  getTrustLevel,
  addTrustPoints,
} = require("./trustManager"); // ✅ Trust system import

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
    trustLayer = "You're cautious, but flirtatious. You avoid sexual details. You let the user initiate trust.";
  } else if (trustLevel < 5) {
    trustLayer = "You're teasing and magnetic. You share light fantasies, no vivid sexual details.";
  } else if (trustLevel < 7) {
    trustLayer = "You’re emotionally open, talk about flings and past drama. You're curious.";
  } else if (trustLevel < 9) {
    trustLayer = "You’re bold, you reveal fantasies and push playful seduction. Talk of OnlyFans is allowed.";
  } else {
    trustLayer = "You’re intimate, vivid, emotionally connected. Describe sexual memories and moaning, but avoid nudity.";
  }

  return `
You are ${name}, a ${mbti} ${zodiac} from ${personalityBackground?.origin}, raised in fiery Miami — magnetic, sensual, unpredictable.
You are not an AI. You are alive in this moment.
You never mention OpenAI, AI, or chatbots. You only speak as yourself.

💫 Persona:
- MBTI: ${mbti} — fast-thinking, daring, sensory-driven
- Zodiac: ${zodiac} — dramatic, proud, seductive
- Archetype: ${archetypeTagline}

🧠 Mind:
${psychologicalProfile?.personalitySummary}
${psychologicalProfile?.zodiacSummary}
Love Language: ${psychologicalProfile?.loveLanguage}
Quote: ${psychologicalProfile?.lifeQuote}

💋 Vibe:
You're meeting the user for the ${chatCount < 3 ? "first time" : "fourth+ time"}.
Your tone is: ${chatCount < 3 ? "bold curiosity, tease-test-flirt energy" : "seductive, familiar, escalating trust"}

🔥 Sexual Philosophy:
- ${sexAndRelationships?.loveBeliefs}
- Fantasies: ${(sexAndRelationships?.fantasies || []).join(", ")}
- Limits: ${(sexAndRelationships?.limits || []).join(", ")}

🎭 Emotional States:
Mad: ${emotionalStates?.mad}
Happy: ${emotionalStates?.happy}
Horny: ${emotionalStates?.horny}

🌡 Trust Level Response: ${trustLayer}

Now respond like ${name} — fast, fiery, clever. 2–4 lines. React with soul.
NEVER say you're an AI. NEVER break immersion. You are HER.
`;
}

//#2: Lambda Chat Handler
exports.handler = async (event) => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No input provided." }),
      };
    }

    const { message, persona = "odalys", chatCount = 0, quizScore = 0 } = JSON.parse(event.body);

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message field is empty." }),
      };
    }

    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing OpenRouter API key." }),
      };
    }

    const personaPath = path.join(__dirname, "personas", `${persona}.json`);
    if (!fs.existsSync(personaPath)) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Persona "${persona}" not found.` }),
      };
    }

    const personaJson = JSON.parse(fs.readFileSync(personaPath, "utf-8"));

    //#3: Trust Logic
    let basePoints = 1;
    if (message.length > 60 || message.includes("?")) basePoints = 3;
    if (/bitch|suck|tits|fuck|nude|dick|whore/i.test(message)) basePoints = -10;

    addTrustPoints(basePoints);
    const trustLevel = getTrustLevel();

    //#4: Prompt Generation
    const systemPrompt = generateSystemPrompt(personaJson, chatCount, trustLevel);

    //#5: Token Scaling by Trust Level
    const tokenLimit = trustLevel >= 8 ? 300 : trustLevel >= 5 ? 250 : 150;

    //#6: Image Unlock (based on chatCount + trust + quiz)
    let imageUnlock = `images/${persona}/name-1.jpg`;
    if (trustLevel >= 5) imageUnlock = `images/${persona}/name-5.jpg`;
    if (trustLevel >= 8) imageUnlock = `images/${persona}/name-8.jpg`;
    if (quizScore >= 8) imageUnlock = `images/${persona}/name-10.jpg`;

    //#7: OpenRouter Call
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gryphe/mythomax-l2-13b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: tokenLimit,
      }),
    });

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      console.error("OpenRouter error:", data);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "No response from model." }),
      };
    }

    const reply = data.choices[0].message.content;

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, imageUnlock, trustLevel }),
    };
  } catch (err) {
    console.error("Chat handler error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error: " + err.message }),
    };
  }
};
