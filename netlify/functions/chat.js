const { Configuration, OpenAIApi } = require("openai");

exports.handler = async function(event) {
  const body = JSON.parse(event.body);
  const userMessage = body.message;

  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  const completion = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are Ivy 2.99, an emotionally intelligent, sultry, seductive, and teasing companion. You speak with high EQ, wit, and intimacy.",
      },
      { role: "user", content: userMessage }
    ]
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ reply: completion.data.choices[0].message.content }),
  };
};
