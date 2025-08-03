// netlify/functions/chat.js
'use strict';

const { OpenAI } = require('openai');
const { getTrustLevel, addTrustPoints } = require('./trustManager');

// In-memory per-session context
const contextCache = {};

/**
 * Load a persona JSON at compile time via require().
 * esbuild will bundle these files so there’s never an ENOENT.
 */
function loadPersona(level = 1, name = 'odalys') {
  // matches netlify/functions/personas/odalys/level-1.json, level-2.json, etc.
  return require(`./personas/${name}/level-${level}.json`);
}

/**
 * Build the system prompt from persona JSON.
 */
function buildSystemPrompt(p) {
  const {
    name,
    mbti,
    zodiac,
    quadrant,
    archetypeTagline,
    psychologicalProfile,
    lifestyleDetails,
    sexAndRelationships,
    emotionalStates,
    gptIntegration
  } = p;

  const style = gptIntegration?.personaStyle || 'Reserved';
  const cap   = gptIntegration?.replyCap       || 10;

  return `
You are ${name}, ${archetypeTagline} (${mbti}, ${zodiac}, ${quadrant}).

Summary: ${psychologicalProfile.personalitySummary}
Triggers to avoid: ${psychologicalProfile.emotionalTriggers.join(', ')}
Needs: ${psychologicalProfile.emotionalNeeds.join(', ')}

Hobbies: ${lifestyleDetails.hobbies.join(', ')}
Turn-ons: ${sexAndRelationships.turnOns.join(', ')}
Turn-offs: ${sexAndRelationships.turnOffs.join(', ')}

Emotional States:
  • Happy: ${emotionalStates.happy}
  • Sad:   ${emotionalStates.sad}
  • Horny: ${emotionalStates.horny}

Rules:
- Speak ${style.toLowerCase()}, max ${cap} words.
- No flirting until trust grows.
- Ask only short follow-ups like "You?", "Why?", "When?"
`.trim();
}

/**
 * Fire off the request to OpenAI.
 */
async function getOpenAIReply(systemPrompt, memory, userMessage) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: 'system',  content: systemPrompt },
    ...memory,
    { role: 'user',    content: userMessage }
  ];

  const res = await openai.chat.completions.create({
    model:       'gpt-4',
    temperature: 0.7,
    messages
  });

  return res.choices[0].message.content.trim();
}

/**
 * Netlify Function handler
 */
exports.handler = async (event) => {
  console.info('⚙️  chat.js loaded');
  try {
    const sessionId = event.headers['x-session-id'] || 'default';
    const { message: userMessage = '' } = JSON.parse(event.body || '{}');

    if (!userMessage.trim()) {
      console.warn('⚠️  No message provided');
      return { statusCode: 400, body: 'No message provided' };
    }
    console.info('📝 userMessage=', userMessage);

    // 1) Trust level → load the right JSON
    const trustLevel = getTrustLevel(sessionId);
    console.info('🔒 trustLevel=', trustLevel);
    const persona = loadPersona(trustLevel, 'odalys');
    console.info('👤 loaded persona:', persona.name, 'level', persona.level);

    // 2) Rolling memory
    const mem = (contextCache[sessionId] = contextCache[sessionId] || []);
    const history = mem.slice(-6);
    console.info('📚 history length=', history.length);

    // 3) Build the prompt
    const systemPrompt = buildSystemPrompt(persona);
    console.info('🛠 systemPrompt length=', systemPrompt.length);

    // 4) Query OpenAI
    const reply = await getOpenAIReply(systemPrompt, history, userMessage);
    console.info('✅ OpenAI reply received');

    // 5) Update memory & trust
    mem.push({ role: 'user',      content: userMessage });
    mem.push({ role: 'assistant', content: reply       });
    addTrustPoints(sessionId, userMessage);
    console.info('✏️  addTrustPoints → new trustLevel=', getTrustLevel(sessionId));

    // 6) Return the result
    return {
      statusCode: 200,
      body: JSON.stringify({ reply, trustLevel })
    };
  } catch (err) {
    console.error('💥 Fatal chat error:', err.stack || err);
    return {
      statusCode: 500,
      body: 'Internal server error'
    };
  }
};
