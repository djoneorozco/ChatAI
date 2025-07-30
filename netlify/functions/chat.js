const { Configuration, OpenAIApi } = require("openai");

exports.handler = async function (event) {
  try {
    // 🔍 DEBUG 1: Check if the event body exists
    if (!event.body) {
      console.error("❌ No input provided in event body.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No input provided." }),
      };
    }

    // 🔍 DEBUG 2: Parse and check message content
    const { message } = JSON.parse(event.body);
    if (!message) {
      console.error("❌ Message field is empty.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message field is empty." }),
      };
    }

    // 🔍 DEBUG 3: Confirm API key is being read
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      console.error("❌ OPENAI_API_KEY not found in environment.");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API key not found." }),
      };
    }

    console.log("✅ OPENAI_API_KEY is set. Length:", OPENAI_KEY.length);

    // 🔧 Configuration and Initialization
    const configuration = new Configuration({
      apiKey: OPENAI_KEY,
    });
    const openai = new OpenAIApi(configuration);

    // 🔍 DEBUG 4: Log input message
    console.log("📨 User Message:", message);

    // 🔧 Chat Completion Request
    const completion = await openai.createChatCompletion({
      model: "gpt-4", // Change to "gpt-3.5-turbo" if needed to test
      messages: [
        {
          role: "system",
          content: "You are Ivy 2.99, a sultry and emotionally intelligent AI companion. Speak with wit, warmth, and playful seduction.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    // 🔍 DEBUG 5: Log OpenAI response
    console.log("🧠 OpenAI Completion Response:", completion.data);

    return {
      statusCode: 200,
      body: JSON.stringify({ reply: completion.data.choices[0].message.content }),
    };
  } catch (err) {
    // 🔍 DEBUG 6: Log error
    console.error("❌ Function Error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Something went wrong." }),
    };
  }
};
