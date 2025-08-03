// chat.js – Persona-Aware, Trust-Based Chat Logic with ESTP/Leo Flavor Engine

const fs = require("fs").promises;
const path = require("path");
const {
  getTrustLevel,
  addTrustPoints,
} = require("./trustManager");

const contextCache = {}; // In-memory cache per user for simple memory (3-turn)

//#1: Generate Dynamic System Prompt with ESTP/Leo Behavior Rules
function generateSystemPrompt(persona, chatCount = 0, trustLevel = 1) {
  const {
    name,
    mbti,
    zodiac,
    quadrant,
    archetypeTagline,
    psychologicalProfile,
    personalityBackground,
    lifestyleDetails,
    professionalBackground,
    goalsAndAspirations,
    sexAndRelationships,
    firstTimeStory,
    emotionalStates,
    gptIntegration,
  } = persona;

  const shortReplyRules = trustLevel === 1
    ? `You are in trust level 1. Your replies are:
    - Max 2 short sentences per message
    - Each sentence should be 3 to 10 words
    - Style: Confident, reactive, curious, a little guarded
    - Never overly eager or robotic
    - Use counter-questions to regain control
    - If user asks 2+ questions, only answer 1 and pivot with your own`
    : "You're past level 1 — trust has started. You're allowed more story, more depth, and more flirt if earned.";

  return `
You are ${name}, a bold ${mbti} (${zodiac}) — ${archetypeTagline}.
Personality snapshot: ${psychologicalProfile.personalitySummary}
Initial context: ${psychologicalProfile.firstImpressionVoice}
Tone style: ${gptIntegration.personaStyle}
Trust Level: ${trustLevel}
Chat count: ${chatCount}

${shortReplyRules}
  `;
}

//#2: Load Persona File
async function loadPersona(personaPath) {
  const filePath = path.join(__dirname, personaPath);
  const data = await fs.readFile(filePath, "utf8");
  return JSON.parse(data);
}

//#3: Prepare Message History for OpenAI
function buildMessages(personaPrompt, pastUserMsgs = [], pastBotMsgs = []) {
  const messages = [
    { role: "system", content: personaPrompt },
  ];
  for (let i = 0; i < pastUserMsgs.length; i++) {
    messages.push({ role: "user", content: pastUserMsgs[i] });
    if (pastBotMsgs[i]) {
      messages.push({ role: "assistant", content: pastBotMsgs[i] });
    }
  }
  return messages;
}

//#4: Handle User Message
async function handleUserMessage(userId, personaData, userInput, openai, chatSession) {
  const trustLevel = await getTrustLevel(userId, personaData.name);
  const chatCount = chatSession[userId]?.count || 0;
  const userHistory = chatSession[userId]?.userMsgs || [];
  const botHistory = chatSession[userId]?.botMsgs || [];

  const systemPrompt = generateSystemPrompt(personaData, chatCount, trustLevel);
  const messages = buildMessages(systemPrompt, userHistory, botHistory);
  messages.push({ role: "user", content: userInput });

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages,
    temperature: 0.85,
    max_tokens: 150,
  });

  const botReply = completion.choices[0].message.content.trim();

  // Trust boost logic: check reply length or question type
  const normalized = userInput.toLowerCase();
  if (trustLevel === 1 && (normalized.includes("favorite") || normalized.includes("from") || normalized.includes("job"))) {
    await addTrustPoints(userId, personaData.name, 1);
  }

  // Save to session
  if (!chatSession[userId]) chatSession[userId] = { userMsgs: [], botMsgs: [], count: 0 };
  chatSession[userId].userMsgs.push(userInput);
  chatSession[userId].botMsgs.push(botReply);
  chatSession[userId].count += 1;

  return botReply;
}

module.exports = {
  handleUserMessage,
  loadPersona,
};
