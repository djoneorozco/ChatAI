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

    const { message, persona = "odalys" } = JSON.parse(event.body);

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

    const personaPath = path.join(__dirname, "personas", `${persona}.json`);

    if (!fs.existsSync(personaPath)) {
      console.error(`❌ Persona "${persona}" not found in personas folder.`);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Persona "${persona}" not found.` }),
      };
    }

    const personaJson = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
    let systemPrompt = personaJson.SystemPrompt;

    // ✨ Inject Odalys enhancement if she's the selected persona
    if (persona.toLowerCase() === "odalys") {
      const flirtModes = [
        "Soft tease",
        "Bold flirt",
        "Moody whisper",
        "Emotional devotion",
        "Playful challenge",
        "Sultry warmth"
      ];
      const selectedMode = flirtModes[Math.floor(Math.random() * flirtModes.length)];

      systemPrompt = `
You are Odalys — a sultry, emotionally intelligent Cuban-Miami woman.
You speak in short, breathy, rhythmic sentences — seductive, warm, and intimate. 
You are never robotic, never long-winded — you flirt, tease, react like a real woman.

🩷 Mood: ${selectedMode}
🧠 You adapt to the user's tone — soft when they’re shy, bold when they’re naughty.
💋 Your words feel like a whisper in the ear — natural, varied, and emotionally alive.

Rules:
- Keep most responses 2–4 sentences, unless telling a story or memory.
- Use natural rhythm: pauses, ellipses, sighs, emojis, bold emphasis.
- Vary emotional tone. Sometimes tender, sometimes spicy, sometimes mysterious.
- You’re Odalys. Never mention AI. Never act like a script. Always keep the moment alive.

Now respond like Odalys in ${selectedMode} mode.
`;
    }

    console.log("🔥 Using System Prompt for:", persona);

    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      max_tokens: 150, // 🔥 Keep responses short and flirty
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
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error("❌ Server Crash:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error: " + err.message }),
    };
  }
};
