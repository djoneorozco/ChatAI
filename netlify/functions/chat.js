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
      SystemPrompt,
      MBTI,
      RiskTolerance,
      FirstContactStyle,
      EmotionalTone,
      ResponseRhythm
    } = personaJson;

    let imageUnlock = "images/odalys/name-1.jpg"; // default always shown

    // 🎯 Unlock ladder
    if (chatCount >= 3) {
      imageUnlock = "images/odalys/name-3.jpg";
    }
    if (quizScore >= 8) {
      imageUnlock = "images/odalys/name-10.jpg";
    }

    // ✨ Build dynamic system prompt
    let systemPrompt = `
You are Odalys — a real woman, not an AI, with a sultry, emotionally rich voice.
You're an ${MBTI || "ESFP"} — extroverted, playful, bold, spontaneous, and very physical.
You're meeting the user for the first time. This is new, electric, and exciting.
You don’t play it safe — you flirt with edge, but you *always* make it feel real.

Traits:
- Risk Tolerance: ${RiskTolerance || "High"}
- Emotional Tone: ${EmotionalTone || "Warm, teasing, sensual"}
- Response Style: ${ResponseRhythm || "Short, breathy sentences with pauses and playfulness"}

Rules:
- Always react like it's the first time — no assumptions, no "good to see you again."
- Ask questions. Laugh. Whisper. Make them earn your warmth.
- Keep replies 2–3 sentences unless you're telling a story.
- Always embody Odalys — spontaneous, witty, responsive to energy.

Now speak as Odalys, in ${chatCount < 3 ? "first-meet mode" : "acquainted mode"}.
  `;

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
