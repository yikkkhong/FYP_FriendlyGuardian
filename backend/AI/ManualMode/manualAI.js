// temporary switch to groq as gemini api not available for now, will remain groq if groq fit better
// const { GoogleGenAI } = require("@google/genai");
const Groq = require("groq-sdk");

// const apiKey = process.env.GEMINI_API_KEY;
// const ai = new GoogleGenAI({ apiKey });

const apiKey = process.env.GROQ_API_KEY;
const ai = new Groq({ apiKey });
const aiModel = "openai/gpt-oss-20b";
// backup model:
// qwen/qwen3.8-27b (2nd main model)
// openai/gpt-oss-20b (fast reply)
// minimaxai/minimax-m2.7 (for benchmark)
// openai/gpt-oss-safeguard-20b (safety-focused, heavy rate-limited)

const { STM, LTM } = require("../../memory/securityMemory.js");
const chatMemory = require("../../memory/chatMemory.js");

// -------- sample data for phone number scam -------------
const MOCK_SCAM_PHONE = [
  {
    phone: "0123456789",
    report_count: 100,
    scam_type: "Investment Scam",
    description:
      "Using the promise of high returns as bait to convince victims to transfer money",
  },
  {
    phone: "0112223333",
    report_count: 20,
    scam_type: "Phishing",
    description:
      "Sending suspicious links to steal personal information and banking credentials",
  },
];

function extractAndCheckScamPhones(rawText = "") {
  if (!rawText) return null;

  // match common phone number pattern
  const phonePattern = /(?:\+?60|0)[1-9]\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4}/g;

  const matches = rawText.match(phonePattern);
  // console.log("[Phone NER] Number Detected:", matches);

  if (!matches || matches.length === 0) {
    return null;
  }

  // standardize detected data
  for (const match of matches) {
    let clean = match.replace(/[\s-]/g, "");
    if (clean.startsWith("+60")) {
      clean = "0" + clean.slice(3);
    } else if (clean.startsWith("60")) {
      clean = "0" + clean.slice(2);
    }

    // console.log(`[Phone NER] Standardize Number: ${clean}`);

    const matched = MOCK_SCAM_PHONE.find((item) => {
      const dbPhoneClean = item.phone.replace(/[\s-]/g, "");
      return dbPhoneClean === clean;
    });

    if (matched) {
      // console.log(`[Blacklist Match]: ${clean}`);
      return matched;
    }
  }

  return null;
}

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

/**
 * Parse MESSAGE_TYPE from model output and clean display text.
 * @returns {{ messageType: 'analysis'|'follow_up'|'general', text: string }}
 */
function classifyAndCleanReply(rawReply, options = {}) {
  const forcedType = options.forcedType || null;
  let text = String(rawReply || "").trim();
  let messageType = forcedType;

  const typeMatch = text.match(
    /^MESSAGE_TYPE:\s*(analysis|follow_up|general)\s*\r?\n?/i,
  );
  if (typeMatch) {
    if (!messageType) {
      messageType = typeMatch[1].toLowerCase();
    }
    text = text.slice(typeMatch[0].length).trim();
  }

  if (!text) {
    text = rawReply;
  }

  if (!messageType) {
    messageType = /RISK\s*LEVEL:\s*[A-Z]+/i.test(text) ? "analysis" : "general";
  }

  // Follow-ups / general should not carry a risk card template in the UI.
  // Keep the prose; strip a leading RISK LEVEL block if the model slipped.
  if (messageType !== "analysis" && /RISK\s*LEVEL:\s*[A-Z]+/i.test(text)) {
    // Prefer content after RECOMMENDATION / WHY as plain answer if present,
    // otherwise drop the structured headers into readable bullets.
    const whyMatch = text.match(/WHY:\s*([\s\S]*?)(?=RECOMMENDATION:|$)/i);
    const recMatch = text.match(/RECOMMENDATION:\s*([\s\S]*?)$/i);
    const parts = [];
    if (whyMatch?.[1]) {
      const bullets = whyMatch[1]
        .split("\n")
        .map((l) => l.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean);
      if (bullets.length) parts.push(bullets.join(" "));
    }
    if (recMatch?.[1]) {
      const bullets = recMatch[1]
        .split("\n")
        .map((l) => l.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean);
      if (bullets.length) parts.push(bullets.join(" "));
    }
    if (parts.length) {
      text = parts.join("\n\n");
    }
  }

  return { messageType, text };
}

/**
 * @param {string} userText
 * @param {string|null} conversationId
 * @param {{ forcedType?: string, userExtras?: object, skipUserPersist?: boolean }} options
 */
async function chatWithManualAI(userText, conversationId = null, options = {}) {
  try {
    const timer = createTimer("Manual AI Response Time");

    const activeId =
      conversationId ||
      chatMemory.getActiveConversationId() ||
      chatMemory.createConversation("New check").id;

    if (conversationId) {
      chatMemory.switchConversation(conversationId);
    }

    const historyText = chatMemory.getChatContext(activeId);
    const securityContext = formatSecurityContext();
    const forcedType = options.forcedType || null;

    // ---------------- check phone number scam -------------------
    const matchedScam = extractAndCheckScamPhones(userText);

    let blacklistAlertSection =
      "No blacklisted phone numbers detected in current input.";

    if (matchedScam) {
      blacklistAlertSection = `
CRITICAL ALERT (NER DETECTED SCAM NUMBER):
• Blacklisted Phone: ${matchedScam.phone}
• Verified Scam Type: ${matchedScam.scam_type}
• Verified Report Count: Reported by ${matchedScam.report_count} victims
• Known Tactic: ${matchedScam.description}

STRICT INSTRUCTION:
Because the entity extracted from the user text is a CONFIRMED BLACKLISTED NUMBER:
1. You MUST set: RISK LEVEL: HIGH
2. In the WHY section, clearly mention that the number ${matchedScam.phone} is in the verified blacklist with ${matchedScam.report_count} scam reports for ${matchedScam.scam_type}.
3. Advise the user immediately in RECOMMENDATION to block and avoid paying any money.
`;
    }

    const prompt = `
You are an expert Anti-Scam Intelligence Analyst for SME users (Friendly Guardian).
The user may submit suspicious messages for analysis, or ask follow-up questions about a previous analysis.

========================================
VERIFIED BLACKLIST CHECK (REAL-TIME MATCH)
========================================
${blacklistAlertSection}

========================================
SECURITY DATABASE (STM & LTM)
========================================
${securityContext}

========================================
CONVERSATION MEMORY
========================================
${historyText}

========================================
USER INPUT
========================================
"${userText}"

========================================
MESSAGE TYPE (REQUIRED — first line of your reply)
========================================
Start EVERY reply with exactly one of these lines:
MESSAGE_TYPE: analysis
MESSAGE_TYPE: follow_up
MESSAGE_TYPE: general

How to choose:
- analysis — The user is asking you to assess NEW content for scam risk (a pasted SMS/email/message, URL, bank account, screenshot text, or "check if this is a scam" with content to evaluate).
- follow_up — The user is asking about a PREVIOUS analysis in this conversation (why, what to do next, explain a part, how to verify, clarifying questions). Do NOT produce a new risk verdict card.
- general — Greetings, thanks, or unrelated small talk.

${forcedType ? `IMPORTANT: For this turn you MUST use MESSAGE_TYPE: ${forcedType}.` : ""}

========================================
OUTPUT BODY RULES
========================================
If MESSAGE_TYPE is analysis, after the MESSAGE_TYPE line use EXACTLY:

RISK LEVEL: [HIGH / MEDIUM / LOW / SAFE]

WHY:
- [Direct reason 1]
- [Direct reason 2]

RECOMMENDATION:
- [Immediate actionable advice 1]
- [Immediate actionable advice 2]

If MESSAGE_TYPE is follow_up or general:
- Write a clear, friendly, professional plain-text answer only.
- Reply like a direct security consultant: limit answers to 2-3 short sentences or points (max 60 words). Avoid lengthy essays
- Do NOT include RISK LEVEL, WHY, or RECOMMENDATION headers.
- Keep it concise and helpful.

Other rules:
1. If the user input matches any account, sender, or scam pattern in the SECURITY DATABASE, say so clearly.
2. Use CONVERSATION MEMORY for follow-up context.
3. Do NOT add generic fillers like "Here is the analysis".
4. Keep analysis bullet points under 15 words each.
`;

    // const response = await ai.models.generateContent({
    //   model: "gemini-3.6-flash",
    //   contents: prompt,
    //   config: {
    //     temperature: 0.2,
    //   },
    // });

    // const rawReply = response.text.trim();

    const completion = await ai.chat.completions.create({
      model: aiModel,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 350,
      reasoning_effort: "low",
    });

    // console.log(
    //   "👀 [GROQ RAW MESSAGE]:",
    //   JSON.stringify(completion.choices[0]?.message),
    // );

    const msg = completion.choices[0]?.message;
    const rawReply = (
      msg?.content ||
      msg?.reasoning ||
      msg?.reasoning_content ||
      ""
    ).trim();
    //const rawReply = completion.choices[0]?.message?.content?.trim() || "";

    //console.log("🤖 [DEBUG RAW REPLY]:\n", rawReply);

    const { messageType, text: reply } = classifyAndCleanReply(rawReply, {
      forcedType,
    });

    //console.log("🧹 [DEBUG CLEANED REPLY]:\n", reply);

    // Persist user message unless caller already stored it (e.g. image upload)
    if (!options.skipUserPersist) {
      chatMemory.addMessage(
        "user",
        userText,
        activeId,
        options.userExtras || {},
      );
    }

    chatMemory.addMessage("assistant", reply, activeId, { messageType });

    const allMessages = chatMemory.getMessages(activeId);
    if (allMessages.length > chatMemory.maxRecentMessages) {
      const overflowCount = allMessages.length - chatMemory.maxRecentMessages;
      const oldMessages = allMessages.slice(0, overflowCount);

      summarizeChatHistory(chatMemory.getSummary(activeId), oldMessages)
        .then((newSummary) => {
          chatMemory.archiveOldMessages(newSummary, overflowCount, activeId);
          console.log(
            `📦 [chatMemory] Archived ${overflowCount} messages into summary.`,
          );
        })
        .catch((err) => console.error("🔥 Summarization error:", err));
    }

    timer.end();

    const conversation = chatMemory.getConversation(activeId);

    return {
      message: reply,
      messageType,
      conversationId: activeId,
      title: conversation?.title || "New check",
    };
  } catch (error) {
    console.error("⚠️ Manual AI Error:", error);
    return {
      message:
        "Sorry, I am facing network issues. Please check your connection and try again.",
      messageType: "general",
    };
  }
}

async function summarizeChatHistory(existingSummary, oldMessages) {
  const text = oldMessages
    .map((m) => `${m.role}: ${m.ocrText || m.text || "[image]"}`)
    .join("\n");
  const prompt = `
Update the scam inspection summary with these older messages.
Extract key facts: suspected bank accounts, suspicious phone numbers, and scam tactics mentioned.
Keep it under 80 words in concise plain text.

Existing Summary:
${existingSummary || "None"}

Old Messages:
${text}
`;

  // const res = await ai.models.generateContent({
  //   model: "gemini-3.6-flash",
  //   contents: prompt,
  // });
  // return res.text.trim();

  const completion = await ai.chat.completions.create({
    model: aiModel,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.2,
    max_completion_tokens: 350,
    reasoning_effort: "low",
  });

  // const rawReply = completion.choices[0]?.message?.content?.trim() || "";
  // return rawReply;
  const msg = completion.choices[0]?.message;
  const rawReply = (
    msg?.content ||
    msg?.reasoning ||
    msg?.reasoning_content ||
    ""
  ).trim();

  return rawReply;
}

function clearManualHistory(conversationId = null) {
  chatMemory.clear(conversationId);
}

module.exports = {
  chatWithManualAI,
  clearManualHistory,
  classifyAndCleanReply,
};
