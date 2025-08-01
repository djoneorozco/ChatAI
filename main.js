//# main.js

document.getElementById("sendButton").addEventListener("click", async () => {
  const input = document.getElementById("userInput");
  const message = input.value.trim();
  if (!message) return;

  // Show user message
  const chatBox = document.getElementById("chatBox");
  const userMessage = document.createElement("p");
  userMessage.innerHTML = `<strong>You:</strong> ${message}`;
  chatBox.appendChild(userMessage);

  input.value = "";

  // Count messages
  const chatCount = document.querySelectorAll("#chatBox p").length;

  // 🔥 Send to server
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

  // Show bot reply
  const botMessage = document.createElement("p");
  botMessage.innerHTML = `<strong>Odalys:</strong> ${data.reply}`;
  chatBox.appendChild(botMessage);

  // 🎯 Update trust bar
  const trust = Math.max(1, Math.min(data.trustLevel || 1, 10));
  updateTrustMeter(trust);

  // 💋 Update image based on unlock path
  if (data.imageUnlock) {
    const imgEl = document.getElementById("unlockedImage");
    if (imgEl) {
      imgEl.src = data.imageUnlock;
      imgEl.alt = `Unlocked Image for Trust Level ${trust}`;
    }
  }

  // Optional debug
  console.log("📶 Current Trust Level:", trust);
});

//# Trust Bar Update
function updateTrustMeter(trust) {
  const bar = document.querySelector(".trust-bar-fill");
  if (bar) bar.style.width = `${(trust / 10) * 100}%`;

  const trustNumbers = document.querySelectorAll(".trust-bar-numbers span");
  trustNumbers.forEach((el, index) => {
    el.classList.toggle("active", index < trust);
  });
}
