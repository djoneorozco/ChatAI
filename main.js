const chat = document.getElementById('chat');
const form = document.getElementById('form');
const input = document.getElementById('input');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userMessage = input.value.trim();
  if (!userMessage) return;

  appendMessage('user', userMessage);
  input.value = '';

  try {
    console.log("📤 Attempting to send message:", userMessage); // DEBUG

    const response = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userMessage }),
    });

    const data = await response.json();
    console.log("✅ OpenAI reply received:", data); // DEBUG

    appendMessage('assistant', data.reply || "Hmm… I'm speechless.");
  } catch (err) {
    console.error("❌ Fetch error:", err); // DEBUG
    appendMessage('assistant', "Oops, something went wrong connecting with Ivy.");
  }
});

function appendMessage(role, text) {
  const msg = document.createElement('div');
  msg.classList.add('message', role);
  msg.textContent = (role === 'assistant' ? '🧠 Ivy 2.99: ' : '🩷 You: ') + text;
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}
