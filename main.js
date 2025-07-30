const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chat = document.getElementById('chat');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userMessage = input.value.trim();
  if (!userMessage) return;

  appendMessage('user', userMessage);
  input.value = '';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_OPENAI_KEY_HERE'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: "You are Ivy 2.99, an emotionally intelligent, seductive, and witty AI companion. Speak with high EQ, deep curiosity, and warm flirtation." },
        { role: 'user', content: userMessage }
      ]
    })
  });

  const data = await response.json();
  const reply = data.choices[0].message.content;
  appendMessage('assistant', reply);
});

function appendMessage(role, text) {
  const msg = document.createElement('div');
  msg.classList.add('message', role);
  msg.textContent = (role === 'assistant' ? '🧠 Ivy 2.99: ' : 'You: ') + text;
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}
