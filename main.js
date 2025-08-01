//# main.js

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

  // Count messages for basic memory logic
  const chatCount = document.querySelectorAll("#chatBox p").length;

  // 🔥 Send request to Netlify Function
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

  // Show AI reply
  const botMessage = document.createElement("p");
  botMessage.innerHTML = `<strong>Odalys:</strong> ${data.reply}`;
  chatBox.appendChild(botMessage);

  // 🧠 Update trust bar and numbers
  const trust = Math.max(1, Math.min(data.trustLevel || 1, 10));
  updateTrustMeter(trust);

  // 🖼️ Show unlocked image (if any)
  if (data.imageUnlock) {
    const img = document.createElement("img");
    img.src = data.imageUnlock;
    img.alt = "Odalys Background";
    img.classList.add("unlocked-image");
    chatBox.appendChild(img);
  }

  // 🔍 Optional debug log
  console.log("📶 Current Trust Level:", trust);
});

//# Trust Meter Logic
function updateTrustMeter(trust) {
  const bar = document.querySelector(".trust-bar-fill");
  if (bar) bar.style.width = `${(trust / 10) * 100}%`;

  const trustNumbers = document.querySelectorAll(".trust-bar-numbers span");
  trustNumbers.forEach((el, index) => {
    el.classList.toggle("active", index < trust);
  });
}
