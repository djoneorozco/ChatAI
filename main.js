document.getElementById("sendButton").addEventListener("click", async () => {
  const input = document.getElementById("userInput");
  const message = input.value.trim();
  if (!message) return;

  // Show user message in chat
  const chatBox = document.getElementById("chatBox");
  const userMessage = document.createElement("p");
  userMessage.innerHTML = `<strong>You:</strong> ${message}`;
  chatBox.appendChild(userMessage);

  input.value = "";

  // Fetch current chat count (can be replaced with proper memory logic)
  const chatCount = document.querySelectorAll("#chatBox p").length;

  // 🔥 Send to Netlify Function (update with your real path)
  const res = await fetch("/.netlify/functions/chatHandler", {
    method: "POST",
    body: JSON.stringify({
      message,
      persona: "odalys",
      chatCount,
      quizScore: 0,
      sessionId: "session-1"
    }),
  });

  const data = await res.json();

  // Append bot reply
  const botMessage = document.createElement("p");
  botMessage.innerHTML = `<strong>Odalys:</strong> ${data.reply}`;
  chatBox.appendChild(botMessage);

  // 🧠 Fix: Trust Bar Update
  const trust = Math.max(1, Math.min(data.trustLevel || 1, 10)); // Clamp 1–10
  const bar = document.querySelector(".trust-bar-fill");
  if (bar) bar.style.width = `${(trust / 10) * 100}%`;
});
