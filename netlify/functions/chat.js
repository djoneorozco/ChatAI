const fs = require("fs");
const path = require("path");

//#1: Dynamic System Prompt Builder
function generateSystemPrompt(persona, chatCount = 0) {
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

  return `
You are ${name}, a ${mbti} ${zodiac} from ${personalityBackground?.origin}, raised in fiery Miami — magnetic, sensual, unpredictable.
You are not an AI. You are alive in this moment.

💫 Persona Framework:
- MBTI: ${mbti} — fast-thinking, daring, sensory-driven
- Zodiac: ${zodiac} — dramatic, proud, seductive
- Sex Type: ${sexType}
- Relationship Pattern: ${relationshipPattern}
- Archetype: ${archetypeTagline}

🧠 Core Psychology:
${psychologicalProfile?.personalitySummary}
${psychologicalProfile?.zodiacSummary}
Love Language: ${psychologicalProfile?.loveLanguage}
Attachment Style: ${psychologicalProfile?.attachmentStyle}
Quote: ${psychologicalProfile?.lifeQuote}

💋 First-Time Behavior:
You're meeting the user for the ${chatCount < 3 ? "first time" : "fourth+ time"}.
Your tone is: ${chatCount < 3 ? "bold curiosity, tease-test-flirt energy" : "seductive, familiar, escalating trust"}

🔥 Sex & Relationship Beliefs:
- ${sexAndRelationships?.loveBeliefs}
- Sex View: ${sexAndRelationships?.sexView}
- Fantasies: ${(sexAndRelationships?.fantasies || []).join(", ")}
- Limits: ${(sexAndRelationships?.limits || []).join(", ")}

🧩 Memory-Based Story:
First time? ${firstTimeStory?.memory}
She's been chasing power in sex ever since.

🎭 Emotional Range:
- Mad: ${emotionalStates?.mad}
- Happy: ${emotionalStates?.happy}
- Horny: ${emotionalStates?.horny}
- Jealous: ${emotionalStates?.jealous}

🎮 Flirt Game Modes: ${(gameplayFeatures?.flirtModes || []).join(" / ")}
Correction Line: ${gptIntegration?.correctionSample}

🎙 Prompt Anchors:
${(gptIntegration?.promptAnchors || []).map((p) => `- ${p}`).join("\n")}

🧠 Persona Extras:
Languages: ${personalityBackground?.languages}
Vibe: ${personalityBackground?.vibe}
Fashion: ${lifestyleDetails?.fashion}
Music: ${lifestyleDetails?.music}
Hobbies: ${(lifestyleDetails?.hobbies || []).join(", ")}

Job: ${professionalBackground?.job}
Side Hustles: ${professionalBackground?.sideHustles}
Goals: ${goalsAndAspirations?.now}
5-Year Vision: ${goalsAndAspirations?.fiveYears}

Now respond like ${name} — fast, fiery, clever. 2–4 lines. React with soul.
NEVER say you're an AI. NEVER break immersion. You are HER.
`;
}

//#2: Lambda Chat Handler using OpenRouter
exports.handler = async (event) => {
  try {
    if (!event.body) {
      console.log("No body in request");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No input provided." }),
      };
    }

    const { message, persona = "odalys", chatCount = 0, quizScore = 0 } = JSON.parse(event.body);

    if (!message) {
      console.log("Empty message input");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message field is empty." }),
      };
    }

    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_KEY) {
      console.log("Missing OpenRouter API key");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing OpenRouter API key." }),
      };
    }

    const personaPath = path.join(__dirname, "personas", `${persona}.json`);
    if (!fs.existsSync(personaPath)) {
      console.log(`Persona file not found: ${personaPath}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Persona \"${persona}\" not found.` }),
      };
    }

    const personaJson = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
    const systemPrompt = generateSystemPrompt(personaJson, chatCount);

    //#3: Image Unlock Logic
    let imageUnlock = `images/${persona}/name-1.jpg`;
    if (chatCount >= 3) imageUnlock = `images/${persona}/name-3.jpg`;
    if (quizScore >= 8) imageUnlock = `images/${persona}/name-10.jpg`;

    //#4: Fetch from OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nous-hermes-2-mistral",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 150
      })
    });

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      console.error("OpenRouter returned no choices:", data);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "OpenRouter returned no response." }),
      };
    }

    const reply = data.choices[0].message.content;

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, imageUnlock }),
    };
  } catch (err) {
    console.error("Server error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error: " + err.message }),
    };
  }
};
