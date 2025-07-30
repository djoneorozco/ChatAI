// /netlify/functions/chat.js

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Required for __dirname support in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function handler(event) {
  try {
    if (!event.body) {
      console.error("❌ No input provided.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No input provided." }),
      };
    }

    const { message } = JSON.parse(event.body);
    if (!message) {
      console.error("❌ Message is missing.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message field is empty." }),
      };
    }

    // 🔥 Load Leila's personality from JSON
    const personaPath = path.join(__dirname, "personas", "leila.json");
    const personaData = JSON.parse(fs.readFileSync(personaPath, "utf8"));

    const systemPrompt = personaData.systemPrompt || "You are a flirty AI.";

    console.log("📨 User Message:", message);
    console.log("🧠 Persona Loaded:", personaPath);
    console.log("🧾 System Prompt:", systemPrompt.substring(0, 100) + "...");

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "OPENAI_API_KEY not set." }),
      };
    }

    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt, // 👈 Leila's full personality
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = completion?.choices?.[0]?.message?.content;
    return {
      statusCode: 200,
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error("💥 Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
