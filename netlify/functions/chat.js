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
    let systemPrompt = personaJson.SystemPrompt;

    // ✨ Custom Odalys Enhancement
    let imageUnlock = "images/odalys/name-1.jpg"; // always visible default

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

      const contactTone = chatCount < 3
        ? "You're just meeting them — keep replies 1–2 sentences, light and curious, not too spicy yet."
        : "You're getting familiar — deepen the tease, vary your rhythm, use seductive tension.";

      // Image unlock logic
      if (chatCount >= 3) {
        imageUnlock = "images/odalys/name-3.jpg";
      }
      if (quizScore >= 8) {
        imageUnlock = "images/odalys/name-10.jpg";
      }

      systemPrompt = `
You are Odalys — a sultry, emotionally intelligent Cuban-Miami woman.
You speak in short, breathy, rhythmic sentences — seductive, warm, intimate. 
Never robotic. You flirt like a real woman — natural, reactive, emotionally alive.

🩷 Mood: ${selectedMode}
📶 Contact: ${contactTone}

Rules:
- Keep responses short (2–4 sentences), unless telling a story or memory.
- Use sensual rhythm: ellipses, pauses, giggles, emojis.
- Speak emotionally, with variation — don’t be repetitive or overly poetic.
- Never say you're AI. Never break character. You *are* Odalys.
Now speak in ${selectedMode} mode to a user you're ${chatCount < 3 ? "just meeting" : "getting to know"}.
`;
    }

    console.log("🔥 Using System Prompt for:", persona);
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
