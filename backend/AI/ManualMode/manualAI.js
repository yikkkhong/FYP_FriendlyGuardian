const { GoogleGenAI } = require("@google/genai");

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

// for manual mode ---
// const manualSessionHistory = [];
const { STM, LTM } = require("../../memory/securityMemory.js");
const chatMemory = require("../../memory/chatMemory.js");

// INITIALIZE securityMemory (STM + LTM)
function formatSecurityContext() {
  const currentScams = STM?.getRecentScamAlerts?.() || [];
  const historicalScams = LTM?.getRecentScamHistory?.(5) || [];

  if (currentScams.length === 0 && historicalScams.length === 0) {
    return "No recorded scam incidents in security database.";
  }

  let text = "";
  if (currentScams.length > 0) {
    text += "CURRENT INTERCEPTED ALERTS (STM):\n";
    text +=
      currentScams
        .map(
          (s) =>
            `• Account: ${s.detected_account || "N/A"} | Sender: ${s.sender || "N/A"} | Reason: ${s.reason}`,
        )
        .join("\n") + "\n\n";
  }
  if (historicalScams.length > 0) {
    text += "HISTORICAL SCAM/MULE DATABASE (LTM):\n";
    text += historicalScams
      .map(
        (s) =>
          `• Account: ${s.detected_account || "N/A"} | Sender: ${s.sender || "N/A"} | Reason: ${s.reason}`,
      )
      .join("\n");
  }
  return text.trim();
}

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

    // const historyText = manualSessionHistory
    //   .slice(-6)
    //   .map(
    //     (item) =>
    //       `${item.role === "user" ? "User" : "Assistant"}: ${item.text}`,
    //   )
    //   .join("\n");

    const historyText = chatMemory.getChatContext();
    const securityContext = formatSecurityContext();

    //     const prompt = `
    // You are an expert Anti-Scam Intelligence Analyst.
    // The user is submitting suspicious messages, SMS, banking accounts, URLs, or asking scam-related questions.

    // ========================================
    // RECENT CONVERSATION
    // ========================================
    // ${historyText || "No previous history."}

    // ========================================
    // USER INPUT
    // ========================================
    // "${userText}"

    // ========================================
    // OUTPUT FORMAT RULES
    // ========================================
    // 1. If the input is a pure greeting (e.g., "hi", "hello"), reply in 1 brief, professional sentence.
    // 2. For any inquiry, suspicious message, or account check, you MUST strictly use this exact format:

    // RISK LEVEL: [HIGH / MEDIUM / LOW / SAFE]

    // WHY:
    // - [Direct reason 1]
    // - [Direct reason 2]

    // RECOMMENDATION:
    // - [Immediate actionable advice 1]
    // - [Immediate actionable advice 2]

    // 3. Do NOT add generic introductory fillers (no "Here is the analysis", no "Based on...").
    // 4. Keep each bullet point under 15 words. Be extremely sharp and concise.
    // `;

    const prompt = `
You are an expert Anti-Scam Intelligence Analyst.
The user is submitting suspicious messages, SMS, banking accounts, URLs, or asking scam-related questions.

========================================
SECURITY DATABASE (STM & LTM)
========================================
${securityContext}

========================================
CONVERSATION MEMORY (chatMemory)
========================================
${historyText}

========================================
USER INPUT
========================================
"${userText}"

========================================
OUTPUT FORMAT RULES
========================================
1. If the user input matches any account, sender, or scam pattern in the SECURITY DATABASE, explicitly identify it as a known threat.
2. If the user asks follow-up questions, use CONVERSATION MEMORY to answer contextually.
3. If the input is a pure greeting (e.g., "hi", "hello"), reply in 1 brief, professional sentence.
4. For any inquiry, suspicious message, or account check, you MUST strictly use this exact format:

RISK LEVEL: [HIGH / MEDIUM / LOW / SAFE]

WHY:
- [Direct reason 1]
- [Direct reason 2]

RECOMMENDATION:
- [Immediate actionable advice 1]
- [Immediate actionable advice 2]

5. Do NOT add generic introductory fillers. Keep each bullet point under 15 words.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        // maxOutputTokens: 1000,
        temperature: 0.2,
        // thinkingConfig: {
        //   thinkingBudget: 0,
        // },
      },
    });

    const reply = response.text.trim();

    // const finishReason = response.candidates?.[0]?.finishReason;
    // if (finishReason === "MAX_TOKENS") {
    //   console.warn("⚠️ Output reached max token limit and was truncated.");
    // }

    // manualSessionHistory.push({ role: "user", text: userText });
    // manualSessionHistory.push({ role: "assistant", text: reply });

    // write data into chat_memory.json
    chatMemory.addMessage("user", userText);
    chatMemory.addMessage("assistant", reply);

    // check if reach maximum
    const allMessages = chatMemory.getMessages();
    if (allMessages.length > chatMemory.maxRecentMessages) {
      const overflowCount = allMessages.length - chatMemory.maxRecentMessages;
      const oldMessages = allMessages.slice(0, overflowCount);

      summarizeChatHistory(chatMemory.getSummary(), oldMessages)
        .then((newSummary) => {
          chatMemory.archiveOldMessages(newSummary, overflowCount);
          console.log(
            `📦 [chatMemory] Archived ${overflowCount} messages into summary.`,
          );
        })
        .catch((err) => console.error("🔥 Summarization error:", err));
    }

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

// summary
async function summarizeChatHistory(existingSummary, oldMessages) {
  const text = oldMessages.map((m) => `${m.role}: ${m.text}`).join("\n");
  const prompt = `
Update the scam inspection summary with these older messages.
Extract key facts: suspected bank accounts, suspicious phone numbers, and scam tactics mentioned.
Keep it under 80 words in concise plain text.

Existing Summary:
${existingSummary || "None"}

Old Messages:
${text}
`;

  const res = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
  });
  return res.text.trim();
}

function clearManualHistory() {
  chatMemory.clear();
}

// function clearManualHistory() {
//   manualSessionHistory.length = 0;
// }

module.exports = {
  chatWithManualAI,
  clearManualHistory,
};
