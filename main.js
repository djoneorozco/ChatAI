document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('user-input');
  const chat = document.getElementById('chat');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userMessage = input.value.trim();
    if (!userMessage) return;

    appendMessage('user', userMessage);
    input.value = '';

    try {
      const response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();
      appendMessage('assistant', data.reply || 'Hmm… I’m speechless.');
    } catch (err) {
      console.error('Error:', err);
      appendMessage('assistant', "Oops, something went wrong connecting with Ivy.");
    }
  });

  function appendMessage(role, text) {
    const msg = document.createElement('div');
    msg.classList.add('message', role);
    msg.textContent = (role === 'assistant' ? '🧠 Ivy 2.99: ' : 'You: ') + text;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }
});
