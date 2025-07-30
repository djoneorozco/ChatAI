const { Configuration, OpenAIApi } = require("openai");

exports.handler = async function (event) {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No input provided." }),
      };
    }

    const { message } = JSON.parse(event.body);
    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message field is empty." }),
      };
    }

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const completion = await openai.createChatCompletion({
      model: "gpt-4",
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

    return {
      statusCode: 200,
      body: JSON.stringify({ reply: completion.data.choices[0].message.content }),
    };
  } catch (err) {
    console.error("Function Error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Something went wrong." }),
    };
  }
};
