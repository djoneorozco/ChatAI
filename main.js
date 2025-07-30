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
