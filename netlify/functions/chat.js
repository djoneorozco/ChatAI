const { Configuration, OpenAIApi } = require("openai");

exports.handler = async function (event) {
  try {
    // 🔍 DEBUG 1: Check if event body exists
    if (!event.body) {
      console.error("❌ No input provided in event body.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No input provided." }),
      };
    }

    const { message } = JSON.parse(event.body);
    if (!message) {
      console.error("❌ Message field is empty.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message field is empty." }),
      };
    }

    // 🔍 DEBUG 2: Check API Key
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      console.error("❌ OPENAI_API_KEY not found in environment.");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API key not found in server env." }),
      };
    }

    console.log("🔑 OPENAI_API_KEY found. First 5 chars:", OPENAI_KEY.slice(0, 5));

    // 🔧 OpenAI Setup
    const configuration = new Configuration({ apiKey: OPENAI_KEY });
    const openai = new OpenAIApi(configuration);

    console.log("📨 User Message:", message);

    const completion = await openai.createChatCompletion({
      model: "gpt-4", // fallback to "gpt-3.5-turbo" if needed
      messages: [
        {
          role: "system",
          content:
            "You are Ivy 2.99, a sultry and emotionally intelligent AI companion. Speak with wit, warmth, and playful seduction.",
        },
        { role: "user", content: message },
      ],
    });

    console.log("🧠 OpenAI raw reply:", JSON.stringify(completion.data, null, 2));

    const reply = completion.data.choices?.[0]?.message?.content || "Hmm… I'm speechless.";
    return {
      statusCode: 200,
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error("❌ Function Error:", err.message);
    if (err.response?.data) {
      console.error("💥 OpenAI Response Error:", err.response.data);
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error from Ivy." }),
    };
  }
};
