const { GoogleGenAI } = require("@google/genai");

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

// for manual mode ---
const manualSessionHistory = [];

//check timing create timer
function createTimer(label) {
  const start = performance.now();

  return {
    end(extra = "") {
      const elapsed = performance.now() - start;
      console.log(
        `⏱️ [${label}] ${elapsed.toFixed(0)} ms${extra ? ` - ${extra}` : ""}`,
      );
      return elapsed;
    },
  };
}

async function chatWithManualAI(userText) {
  try {
    const timer = createTimer("Manual AI Response Time");

    const historyText = manualSessionHistory
      .slice(-6)
      .map(
        (item) =>
          `${item.role === "user" ? "User" : "Assistant"}: ${item.text}`,
      )
      .join("\n");

    const prompt = `
You are an expert Anti-Scam Intelligence Analyst.
The user is submitting suspicious messages, SMS, banking accounts, URLs, or asking scam-related questions.

========================================
RECENT CONVERSATION
========================================
${historyText || "No previous history."}

========================================
USER INPUT
========================================
"${userText}"

========================================
OUTPUT FORMAT RULES
========================================
1. If the input is a pure greeting (e.g., "hi", "hello"), reply in 1 brief, professional sentence.
2. For any inquiry, suspicious message, or account check, you MUST strictly use this exact format:

RISK LEVEL: [HIGH / MEDIUM / LOW / SAFE]

WHY:
- [Direct reason 1]
- [Direct reason 2]

RECOMMENDATION:
- [Immediate actionable advice 1]
- [Immediate actionable advice 2]

3. Do NOT add generic introductory fillers (no "Here is the analysis", no "Based on...").
4. Keep each bullet point under 15 words. Be extremely sharp and concise.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const reply = response.text.trim();

    manualSessionHistory.push({ role: "user", text: userText });
    manualSessionHistory.push({ role: "assistant", text: reply });

    timer.end();

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
