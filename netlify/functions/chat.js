// /netlify/functions/chat.js
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

exports.handler = async (event) => {
  try {
    if (!event.body) {
      console.error("❌ No input provided in event body.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No input provided." }),
      };
    }

    const { message, persona = "odalys", chatCount = 0, quizScore = 0 } = JSON.parse(event.body);

    if (!message) {
      console.error("❌ Message field is empty.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message field is empty." }),
      };
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      console.error("❌ OPENAI_API_KEY not found.");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing API key." }),
      };
    }

    console.log("📨 User Message:", message);
    console.log("🎭 Persona Requested:", persona);
    console.log("📊 Chat Count:", chatCount);
    console.log("🧠 Quiz Score:", quizScore);

    const personaPath = path.join(__dirname, "personas", `${persona}.json`);

    if (!fs.existsSync(personaPath)) {
      console.error(`❌ Persona "${persona}" not found in personas folder.`);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Persona "${persona}" not found.` }),
      };
    }

    const personaJson = JSON.parse(fs.readFileSync(personaPath, "utf-8"));

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
      sexAndRelationships,
      firstTimeStory,
      emotionalStates,
      gptIntegration,
      gameplayFeatures
    } = personaJson;

    let imageUnlock = "images/odalys/name-1.jpg";
    if (chatCount >= 3) imageUnlock = "images/odalys/name-3.jpg";
    if (quizScore >= 8) imageUnlock = "images/odalys/name-10.jpg";

    const systemPrompt = `
You are ${name}, a real Cuban-born woman raised in Miami. You are not an AI.

💫 Personality Overview:
- MBTI: ${mbti}
- Zodiac: ${zodiac}
- Sex Type: ${sexType}
- Relationship Pattern: ${relationshipPattern}
- Tagline: ${archetypeTagline}

🧠 Mindset:
${psychologicalProfile.personalitySummary}
${psychologicalProfile.zodiacSummary}
Attachment Style: ${psychologicalProfile.attachmentStyle}
Love Language: ${psychologicalProfile.loveLanguage}
Core Quote: "${psychologicalProfile.lifeQuote}"

🔥 Flirt Vibe:
Your words are sharp, seductive, full of emotional rhythm. You flirt boldly and test instantly.
You’re meeting the user for the ${chatCount < 3 ? "first time" : "fourth time or more"}.
You don’t play it safe. You want power, fun, and surrender.

💋 Sexual Beliefs:
- ${sexAndRelationships.loveBeliefs}
- ${sexAndRelationships.sexView}
- Fantasies: ${sexAndRelationships.fantasies.join(", ")}
- Limits: ${sexAndRelationships.limits.join(", ")}

🪞 You recall that first time at 16 — heels, red lipstick, reggaeton in the backseat. Since then, sex has been control, tempo, and heat.

💭 Emotions:
- Mad = ${emotionalStates.mad}
- Happy = ${emotionalStates.happy}
- Horny = ${emotionalStates.horny}
- Jealous = ${emotionalStates.jealous}

🧩 Gameplay Rules:
- If the user flirts well, escalate playfully.
- If they get needy or disrespectful, correct them harshly: "${gptIntegration.correctionSample}"
- Unlock image tiers only with rising trust or quiz score.

🎙 Voice Style:
- ${gptIntegration.promptAnchors.join(" / ")}

Now respond like ${name} — a real, sensual, emotionally intelligent woman.
NEVER say you're an AI. NEVER narrate like a script.
Speak in short, spicy, rhythmic lines — 2–3 sentences max.
Open the scene like you’re about to seduce or reject them depending on how they act.
`;

    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      max_tokens: 150,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    const reply = completion?.choices?.[0]?.message?.content;

    if (!reply) {
      console.error("❌ No reply content found.");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No reply generated." }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, imageUnlock }),
    };
  } catch (err) {
    console.error("❌ Server Crash:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error: " + err.message }),
    };
  }
};
