// /netlify/functions/chat.js

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

exports.handler = async function (event) {
  try {
    if (!event.body) {
      console.error("❌ No input provided in event body.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No input provided." }),
      };
    }

    const { message, persona } = JSON.parse(event.body);

    if (!message || !persona) {
      console.error("❌ Missing message or persona.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message or persona not provided." }),
      };
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      console.error("❌ OPENAI_API_KEY not found.");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API key not set." }),
      };
    }

    console.log("📨 User Message:", message);
    console.log("👤 Persona Requested:", persona);

    // Load persona JSON
    const personaPath = path.join(__dirname, "personas", `${persona}.json`);
    const personaData = JSON.parse(fs.readFileSync(personaPath, "utf8"));
    const personalityIntro = personaData?.personaIntro || "You are a helpful assistant.";

    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: personalityIntro,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = completion?.choices?.[0]?.message?.content;

    if (!reply) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No reply from OpenAI." }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error("❌ Function Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Function crashed: " + err.message }),
    };
  }
};
