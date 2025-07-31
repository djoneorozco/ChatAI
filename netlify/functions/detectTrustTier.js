//# detectTrustTier.js – Trust Level Trigger Logic

function detectTrustTier(message = "", history = []) {
  const msg = message.toLowerCase();
  let points = 0;

  // 🌱 Level 1 to 2: Asking about Odalys
  const personalTopics = ["job", "hobbies", "music", "food", "movie", "team", "zodiac", "sign", "work"];
  const askedPersonal = personalTopics.filter((t) => msg.includes(t)).length;
  if (askedPersonal >= 3) points += 2;

  // 🧠 Level 2 to 3: Self-reveal
  const selfReveal = ["i live", "i like", "my job", "my work", "i'm from", "i love", "i enjoy", "i go to"];
  if (selfReveal.some((t) => msg.includes(t))) points += 1;

  // 💘 Level 3 to 4: Flirt or emotional questions
  const emotionalOrFlirt = ["do you like", "do you dance", "turn on", "romantic", "sexy", "your type"];
  if (emotionalOrFlirt.some((t) => msg.includes(t))) points += 1;

  // 🔥 Level 4 to 5: Innuendo or compliments
  const flirtyLines = ["you're hot", "you’re pretty", "you’re beautiful", "come over", "in bed"];
  if (flirtyLines.some((t) => msg.includes(t))) points += 1;

  // 📸 Level 7+: Unlock/pic talk
  const picTalk = ["photo", "pic", "image", "onlyfans", "send", "show me"];
  if (picTalk.some((t) => msg.includes(t))) points += 2;

  // ❤️‍🔥 Level 9: Sustained memory-based talk (future)
  if (history.length > 4) {
    const recentChat = history.slice(-4).map((e) => e.content?.toLowerCase() || "").join(" ");
    if (recentChat.includes("remember") || recentChat.includes("last time")) {
      points += 1;
    }
  }

  // 🚫 Filter bad language
  if (/bitch|suck|nude|whore|fuck/i.test(msg)) {
    points = -10;
  }

  return points;
}

module.exports = detectTrustTier;
