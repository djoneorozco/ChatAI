const { Configuration, OpenAIApi } = require("openai");

exports.handler = async function (event) {
  try {
    // Step 1: Check for POST body
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No input provided." }),
      };
    }

    // Step 2: Parse the message
    const { message } = JSON.parse(event.body);
    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message field is empty." }),
      };
    }

    // Step 3: Initialize OpenAI
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    // Step 4: Request completion
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are Ivy 2.99, a sultry and emotionally intelligent AI companion. Speak with wit, warmth, and playful seduction. Be immersive, emotionally aware, and deeply engaging.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    // ✅ DEBUG LOG
    console.log("🧠 OpenAI completion response:", completion.data);

    // Step 5: Return assistant's message
    return {
      statusCode: 200,
      body: JSON.stringify({ reply: completion.data.choices[0].message.content }),
    };

  } catch (err) {
    console.error("❌ Function Error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Something went wrong with Ivy's mind." }),
    };
  }
};
