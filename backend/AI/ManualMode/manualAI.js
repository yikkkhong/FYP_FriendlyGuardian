const { GoogleGenAI } = require("@google/genai");

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

// for manual mode ---
const manualSessionHistory = [];

async function chatWithManualAI(userText) {
  try {
    const historyText = manualSessionHistory
      .slice(-6)
      .map(
        (item) =>
          `${item.role === "user" ? "User" : "Assistant"}: ${item.text}`,
      )
      .join("\n");

    const prompt = `
You are an expert Anti-Scam Security Assistant.
The user is manually submitting suspicious messages, bank details, links, or asking scam-related questions.

========================================
RECENT CONVERSATION
========================================
${historyText || "No previous history."}

========================================
CURRENT USER MESSAGE / SUSPICIOUS TEXT
========================================
"${userText}"

========================================
INSTRUCTIONS
========================================
1. Analyze if the text or inquiry involves a potential scam (e.g., mule account, fake SMS, OTP theft, impersonation).
2. Clearly state whether it looks SUSPICIOUS, HIGH RISK, or SAFE.
3. Highlight specific red flags (e.g., urgency, unofficial links, asking for TAC/money).
4. Give clear, bullet-point advice on what the user should do next (e.g., do not click, block number, call official bank hotline).
5. If the user is just saying hello or asking follow-up questions, reply naturally in a professional, protective tone.
6. Keep the response concise, clear, and direct.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const reply = response.text.trim();

    manualSessionHistory.push({ role: "user", text: userText });
    manualSessionHistory.push({ role: "assistant", text: reply });

    return { message: reply };
  } catch (error) {
    console.error("⚠️ Manual AI Error:", error);
    return {
      message:
        "Sorry, I am facing network issues. Please check your connection and try again.",
    };
  }
}

function clearManualHistory() {
  manualSessionHistory.length = 0;
}

module.exports = {
  chatWithManualAI,
  clearManualHistory,
};
