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

    const { message, persona = "ivy" } = JSON.parse(event.body);

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

    let systemPrompt = "You are Ivy 2.99, a sultry and emotionally intelligent AI companion. Speak with wit, warmth, and playful seduction.";

    const personaPath = path.join(__dirname, "personas", `${persona}.json`);
    if (fs.existsSync(personaPath)) {
      const personaData = fs.readFileSync(personaPath, "utf-8");
      const personaJson = JSON.parse(personaData);
      if (personaJson?.SystemPrompt) {
        systemPrompt = personaJson.SystemPrompt;
        console.log("🧠 Loaded system prompt from:", persona);
      }
    } else {
      console.warn("⚠️ Persona file not found, using fallback Ivy.");
    }

    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
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
