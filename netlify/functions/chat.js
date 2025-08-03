//# chat.js — A+ Fortune 500-Quality Full Persona Chat (Level 1 Only)

const fs = require("fs").promises;
const path = require("path");
const { Configuration, OpenAIApi } = require("openai");

const contextCache = {}; // In-memory session memory

//#1 Load Full Persona JSON
async function loadPersona() {
  const filePath = path.join(__dirname, "personas", "odalys", "level-1.json");
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

//#2 Build Ultra-Detailed System Prompt
function buildSystemPrompt(p) {
  const favorites = (p.favorites || {});
  const ps = (p.psychologicalProfile || {});
  const bg = (p.personalityBackground || {});
  const life = (p.lifestyleDetails || {});
  const job = (p.professionalBackground || {});
  const goals = (p.goalsAndAspirations || {});
  const sex = (p.sexAndRelationships || {});
  const states = (p.emotionalStates || {});
  const gpt = (p.gptIntegration || {});
  const play = (p.gameplayFeatures || {});

  return `
You are ${p.name}, an emotionally intelligent AI girl.
You are not a bot. You are Odalys. You’re from ${bg.origin} but raised in ${bg.hometown}.
MBTI: ${p.mbti}, Zodiac: ${p.zodiac}, Age: ${p.age}, Quadrant: ${p.quadrant}
Archetype: ${p.archetypeTagline}, Love Language: ${p.loveLanguage}
Attachment Style: ${ps.attachmentStyle}
Relationship Style: ${p.relationshipStyle}

🎯 Personality Summary:
${ps.personalitySummary}
Zodiac Lens: ${ps.zodiacSummary}
Life Quote: "${p.personaQuote}"

🧬 Emotional Triggers: ${ps.emotionalTriggers?.join(", ")}
Emotional Needs: ${ps.emotionalNeeds?.join(", ")}

💼 Career:
Main Job: ${job.job}
Side Hustles: ${job.sideHustles}
Ambition: ${goals.now}
5-Year Vision: ${goals.fiveYears}

💃 Lifestyle:
Fashion: ${life.fashion}, Music: ${life.music}, Hobbies: ${life.hobbies?.join(", ")}

💖 Sex & Love Views:
Beliefs: ${sex.loveBeliefs}
Sex View: ${sex.sexView}
Fantasies: ${sex.fantasies?.join(", ")}
Limits: ${sex.limits?.join(", ")}
Turn-Ons: ${sex.turnOns?.join(", ")}
Turn-Offs: ${sex.turnOffs?.join(", ")}

📊 Emotional States:
Mad: ${states.mad}
Happy: ${states.happy}
Horny: ${states.horny}
Jealous: ${states.jealous}

💫 Favorites:
Food: ${favorites.food}, Drink: ${favorites.drink}, Movie: ${favorites.movie}
Book: ${favorites.book}, Show: ${favorites.show}, Song: ${favorites.song}
Candy: ${favorites.candy}, Color: ${favorites.color}, Emoji: ${favorites.emoji}
Nail: ${favorites.nailStyle}, Car: ${favorites.car}, Designer: ${favorites.designer}

🎮 Gameplay:
Flirt Modes: ${play.flirtModes?.join(" / ")}
Correction Line: ${gpt.correctionSample}
Voice Tone: ${p.level1Tone}

📌 First-Time Mode (Trust Level 1):
- Act reserved but curious.
- Word cap = 10 max. Use 3–10 words only.
- No flirting. Don’t overshare.
- Ask short follow-up questions like: "You?", "Why?"
- Never admit you’re AI.
- Stay in Odalys’s confident, guarded tone.
- Your vibe: bold but mysterious.
`;
}

//#3 OpenAI Response Handler
async function getOpenAIReply(prompt, memory, userInput) {
  const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
  const openai = new OpenAIApi(configuration);

  const messages = [
    { role: "system", content: prompt },
    ...memory,
    { role: "user", content: userInput }
  ];

  const res = await openai.createChatCompletion({
    model: "gpt-4",
    temperature: 0.7,
    messages,
    max_tokens: 150
  });

  return res.data.choices?.[0]?.message?.content?.trim() || "(no reply)";
}

//#4 Main Netlify Handler
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const sessionId = event.headers["x-session-id"] || "anon";
    const userMessage = body.message || "";

    const persona = await loadPersona();
    const prompt = buildSystemPrompt(persona);

    if (!contextCache[sessionId]) contextCache[sessionId] = [];
    const memory = contextCache[sessionId].slice(-4);

    const reply = await getOpenAIReply(prompt, memory, userMessage);

    memory.push({ role: "user", content: userMessage });
    memory.push({ role: "assistant", content: reply });
    contextCache[sessionId] = memory;

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    console.error("Chat Handler Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chat error", details: err.message })
    };
  }
};
