const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { GoogleGenAI, Type } = require("@google/genai");
const { STM, LTM } = require("./securityMemory.js");
const ConversationMemory = require("./conversationMemory");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

//check timing
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

async function routeConversation(userText) {
  try {
    //check timing
    const timer = createTimer("Conversation Router");
    //check timing

    const activeConversation = ConversationMemory.getActiveConversation();

    const allConversations = ConversationMemory.getAllConversations();

    const conversationList = allConversations
      .slice(0, 10)
      .map(
        (conversation) =>
          `ID: ${conversation.id}
Title: ${conversation.title}
Topic: ${conversation.topic}
Summary: ${conversation.summary || "No summary"}`,
      )
      .join("\n\n");

    const activeContext = activeConversation
      ? `
Active Conversation:
ID: ${activeConversation.id}
Title: ${activeConversation.title}
Topic: ${activeConversation.topic}
Summary: ${activeConversation.summary || "No summary"}
`
      : "No active conversation.";

    const prompt = `
You are the Conversation Router for an AI companion.

Your job is to determine whether the user's message
should continue the current conversation, switch to an
existing conversation, or create a new conversation.

${activeContext}

Previous Conversations:
${conversationList || "No previous conversations."}

New User Message:
"${userText}"

Rules:

1. CONTINUE
Use CONTINUE when the user is clearly continuing
the current conversation.

2. SWITCH
Use SWITCH when the user is talking about a previous
conversation that already exists.

3. NEW
Use NEW when the user introduces a substantially
different topic that does not match an existing
conversation.

4. Do not create a new conversation just because
the user asks a short or unrelated-looking question.
Use context to understand pronouns such as:
"it", "that", "them", "this".

Return JSON only.
`;
    //check timing
    const geminiTimer = createTimer("Gemini #1 - Conversation Router");
    //check timing

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
            },
            conversation_id: {
              type: Type.STRING,
            },
            title: {
              type: Type.STRING,
            },
            topic: {
              type: Type.STRING,
            },
            reason: {
              type: Type.STRING,
            },
          },
          required: ["action", "conversation_id", "title", "topic", "reason"],
        },
      },
    });
    //check timing
    geminiTimer.end();
    //check timing

    const result = JSON.parse(response.text);

    const validActions = ["CONTINUE", "SWITCH", "NEW"];

    if (!validActions.includes(result.action)) {
      return {
        action: "NEW",
        conversation_id: "",
        title: "New Conversation",
        topic: "general",
        reason: "Invalid router response.",
      };
    }

    //check timing
    timer.end();
    //check timing

    return result;
  } catch (error) {
    console.error("⚠️ Conversation Router Error:", error);

    return {
      action: "CONTINUE",
      conversation_id: ConversationMemory.getActiveConversationId() || "",
      title: "",
      topic: "",
      reason: "Router fallback.",
    };
  }
}

function extractBankAccountRegex(text) {
  if (!text) return null;
  const match =
    text.match(/\b\d{10,16}\b/) ||
    text.match(/\b\d{3,4}[-\s]?\d{3,4}[-\s]?\d{3,6}\b/);
  return match ? match[0] : null;
}

const RISK_KEYWORDS = [
  "transfer",
  "urgent",
  "acc",
  "account",
  "polis",
  "police",
  "duti",
  "tac",
  "otp",
  "maybank",
  "cimb",
  "rhb",
  "block",
  "suspended",
];

function checkRiskKeywords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return RISK_KEYWORDS.some((kw) => lower.includes(kw));
}

function formatScamHistory(incidents) {
  if (!incidents || incidents.length === 0) {
    return "No scam incidents found.";
  }

  return incidents
    .map(
      (incident, index) =>
        `[Scam ${index + 1}]
Time: ${incident.timestamp || incident.saved_at}
Sender: ${incident.sender}
Account: ${incident.detected_account}
Reason: ${incident.reason}
Message: ${incident.text}`,
    )
    .join("\n\n");
}

async function classifyMemoryIntent(userText) {
  //check timing
  const timer = createTimer("Memory Intent");
  //check timing

  try {
    const prompt = `
      Classify what memory is needed for this user's request.

      User:
      "${userText}"

      Return exactly one category:

      CURRENT_SCAM
      - User is asking about a scam or suspicious SMS
        that is currently happening or was just received.

      SCAM_HISTORY
      - User is asking about scam messages/incidents
        they received previously or recently.

      BOTH
      - User wants to compare the current scam with
        previous scam incidents.

      GENERAL
      - The request is not related to scam history.
    `;

    //check timing
    const geminiTimer = createTimer("Gemini #2 - Memory Intent");
    //check timing

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "text/plain",
      },
    });

    //check timing
    geminiTimer.end();
    //check timing

    const intent = response.text.trim().toUpperCase();

    //check timing
    timer.end(`Intent: ${intent}`);

    if (["CURRENT_SCAM", "SCAM_HISTORY", "BOTH", "GENERAL"].includes(intent)) {
      return intent;
    }
    //check timing

    if (["CURRENT_SCAM", "SCAM_HISTORY", "BOTH", "GENERAL"].includes(intent)) {
      return intent;
    }

    return "GENERAL";
  } catch (error) {
    console.error("⚠️ Memory intent classification failed:", error);

    return "GENERAL";
  }
}

async function analyzeSmsWithGemini(messageText, sender) {
  try {
    const prompt = `
      You are Baymax, a protective AI Guardian for elderly users in Malaysia.
      Analyze this intercepted incoming SMS for scam or mule bank account threats:

      SMS Sender: "${sender}"
      SMS Message: "${messageText}"

      Instructions:
      1. Determine if this message is a potential scam or mule account request.
      2. Extract target bank account number if present.
      3. Generate a warm, 1-sentence Baymax advice for an elderly user (gentle Manglish like "don't transfer ah" is encouraged).
      4. Pick suggested_emotion: 'ALERT' (if scam/danger), 'HAPPY' (if safe), or 'NEUTRAL'.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_scam: { type: Type.BOOLEAN },
            detected_account: { type: Type.STRING },
            reason: { type: Type.STRING },
            baymax_message: { type: Type.STRING },
            suggested_emotion: { type: Type.STRING },
          },
          required: [
            "is_scam",
            "detected_account",
            "reason",
            "baymax_message",
            "suggested_emotion",
          ],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error(
      "⚠️ Gemini API Unavailable, Switching to Rule-Engine Fallback...",
    );

    // (Fallback Rule-Engine)
    const regexAccount = extractBankAccountRegex(messageText);
    const hasRiskWords = checkRiskKeywords(messageText);
    const isScam = hasRiskWords || !!regexAccount;

    return {
      is_scam: isScam,
      detected_account: regexAccount || "1122-3344-5566",
      reason: isScam
        ? "Rule Engine: Detected high-risk keywords or account pattern."
        : "Message appears safe.",
      baymax_message: isScam
        ? "Oh no! Please do not transfer any money to this account ah!"
        : "This message looks safe, but always stay cautious!",
      suggested_emotion: isScam ? "ALERT" : "HAPPY",
    };
  }
}

async function chatWithBaymaxWithMemory(userText, conversation) {
  //check timing
  const timer = createTimer("Baymax Chat with Memory");
  //check timing

  try {
    //check timing
    const conversationMemoryTimer = createTimer(
      "Conversation Memory Retrieval",
    );
    //check timing

    // 1. Get Conversation Memory
    const conversationContext = ConversationMemory.getConversationContext(
      conversation.id,
    );

    //check timing
    conversationMemoryTimer.end();
    //check timing

    //check timing
    const securityMemoryTimer = createTimer("Security Memory Retrieval");
    //check timing

    // 2. Classify Security Memory Intent
    const memoryIntent = await classifyMemoryIntent(userText);

    let scamContext = "";

    // 3. Retrieve Security Memory only when needed
    if (memoryIntent === "CURRENT_SCAM") {
      const currentScams = STM.getRecentScamAlerts();

      scamContext = formatScamHistory(currentScams);
    } else if (memoryIntent === "SCAM_HISTORY") {
      const historicalScams = LTM.getRecentScamHistory(10);

      scamContext = formatScamHistory(historicalScams);
    } else if (memoryIntent === "BOTH") {
      const currentScams = STM.getRecentScamAlerts();

      const historicalScams = LTM.getRecentScamHistory(10);

      scamContext = `
CURRENT SCAM ACTIVITY:
${formatScamHistory(currentScams)}

PREVIOUS SCAM INCIDENTS:
${formatScamHistory(historicalScams)}
`;
    }
    //check timing
    securityMemoryTimer.end(`Intent: ${memoryIntent}`);
    //check timing

    // 4. Build Baymax Prompt
    const prompt = `
You are Baymax, a warm, caring and protective AI Guardian
companion for elderly users in Malaysia.

Your job is to talk naturally with the user while keeping
them safe from scams.

========================================
CONVERSATION MEMORY
========================================

${conversationContext}

========================================
SECURITY MEMORY
========================================

${scamContext || "No security memory is relevant to this message."}

========================================
CURRENT USER MESSAGE
========================================

${userText}

========================================
RULES
========================================

1. Continue the current conversation naturally.

2. Use Conversation Memory when the user's message
   refers to something discussed earlier in this
   conversation.

3. Use Security Memory only when it is relevant to
   the user's current question.

4. Never invent a scam incident, bank account,
   previous conversation, or user information.

5. If the user asks about previous scam incidents,
   use the provided Security Memory.

6. Maximum 1 or 2 short sentences.

7. Use simple, gentle English with a Malaysian touch.

8. If the user is worried or in danger, be reassuring
   and protective.

9. suggested_emotion must be one of:
   HAPPY, ALERT, THINKING, or NEUTRAL.
`;

    //check timing
    const geminiTimer = createTimer("Gemini #3 - Baymax Response");
    //check timing

    // 5. Ask Gemini
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",

        responseSchema: {
          type: Type.OBJECT,

          properties: {
            baymax_message: {
              type: Type.STRING,
            },

            suggested_emotion: {
              type: Type.STRING,
            },
          },

          required: ["baymax_message", "suggested_emotion"],
        },
      },
    });

    //check timing
    geminiTimer.end();
    //check timing

    return JSON.parse(response.text);
  } catch (error) {
    console.error("⚠️ Gemini Chat Error, fallback active:", error);

    return {
      baymax_message:
        "I am right here with you! Everything is going to be alright.",

      suggested_emotion: "HAPPY",
    };
  }
}

async function summarizeConversationHistory(existingSummary, oldMessages) {
  try {
    const messagesText = oldMessages
      .map((m) => `${m.role === "user" ? "User" : "Baymax"}: ${m.text}`)
      .join("\n");

    const prompt = `
You are a conversation summarizer for an AI companion.
Update the conversation summary by integrating the new dialog messages into the existing summary.

Existing Summary:
${existingSummary || "No previous summary."}

Older Messages to integrate:
${messagesText}

Instructions:
1. Summarize key facts, user preferences, names, topics discussed, and emotional state.
2. Keep the summary concise (under 100 words), coherent, and written in third person.
3. Return only the updated plain-text summary.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "text/plain",
      },
    });

    return response.text.trim();
  } catch (error) {
    console.error("⚠️ Conversation Summarization Error:", error);
    return existingSummary;
  }
}

io.on("connection", (socket) => {
  console.log("⚡ [Socket.IO] React Frontend Connected:", socket.id);

  socket.on("user_chat", async (data) => {
    console.log("\n💬 [User Chat]:", data.text);

    //check timing
    const totalTimer = createTimer("TOTAL USER CHAT");
    //check timing

    try {
      // 1. Decide which conversation to use
      const route = await routeConversation(data.text);

      console.log("🧭 [Conversation Router]:", route);

      let conversation;

      // 2. CONTINUE
      if (route.action === "CONTINUE") {
        conversation = ConversationMemory.getActiveConversation();

        if (!conversation) {
          conversation = ConversationMemory.createConversation(
            route.title || "New Conversation",
            route.topic || "general",
          );
        }
      }

      // 3. SWITCH
      else if (route.action === "SWITCH") {
        conversation = ConversationMemory.switchConversation(
          route.conversation_id,
        );

        if (!conversation) {
          conversation = ConversationMemory.createConversation(
            route.title || "New Conversation",
            route.topic || "general",
          );
        }
      }

      // 4. NEW
      else {
        conversation = ConversationMemory.createConversation(
          route.title || "New Conversation",
          route.topic || "general",
        );
      }

      // 5. Save USER message
      ConversationMemory.addMessage(conversation.id, "user", data.text);

      // 6. Generate Baymax response
      const aiResponse = await chatWithBaymaxWithMemory(
        data.text,
        conversation,
      );

      // 7. Save BAYMAX message
      ConversationMemory.addMessage(
        conversation.id,
        "baymax",
        aiResponse.baymax_message,
      );

      // Check the current message volume
      const currentConv = ConversationMemory.getConversation(conversation.id);
      const maxAllowed = ConversationMemory.maxRecentMessages || 10;

      if (currentConv && currentConv.messages.length > maxAllowed) {
        const overflowCount = currentConv.messages.length - maxAllowed;
        const messagesToArchive = currentConv.messages.slice(0, overflowCount);

        // summarize -> archive -> trim
        summarizeConversationHistory(currentConv.summary, messagesToArchive)
          .then((updatedSummary) => {
            ConversationMemory.archiveOldMessages(
              currentConv.id,
              updatedSummary,
              overflowCount,
            );
            console.log(
              `📦 [Archive] Conversation ${currentConv.id} archived ${overflowCount} messages.`,
            );
          })
          .catch((err) => console.error("🔥 Archive flow error:", err));
      }

      // 8. Send result to React
      socket.emit("baymax_chat_response", {
        ...aiResponse,

        conversation_id: conversation.id,

        conversation_title: conversation.title,
      });

      //check timing
      totalTimer.end();
      //check timing
    } catch (error) {
      console.error("🔥 User chat processing error:", error);

      socket.emit("baymax_chat_response", {
        baymax_message: "Sorry ah, I had a little problem. Please try again.",

        suggested_emotion: "THINKING",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ [Socket.IO] Frontend Disconnected");
  });
});

app.post("/api/sms-webhook", async (req, res) => {
  console.log("📩 [SMS Webhook Raw Body]:", req.body);

  const text =
    req.body.text ||
    req.body.body ||
    req.body.sms_body ||
    req.body.content ||
    req.body.message ||
    "";
  const sender =
    req.body.sender ||
    req.body.sms_number ||
    req.body.from ||
    req.body.number ||
    "Unknown Sender";

  if (!text) {
    return res
      .status(400)
      .json({ status: "error", message: "Empty message text" });
  }

  const aiResult = await analyzeSmsWithGemini(text, sender);

  if (!aiResult.detected_account) {
    aiResult.detected_account =
      extractBankAccountRegex(text) || "1122-3344-5566";
  }

  console.log("🤖 [Final Decision]:", aiResult);

  //if (aiResult.is_scam) {
  const alertData = {
    text: text,
    sender: sender,
    detected_account: aiResult.detected_account,
    reason: aiResult.reason,
    baymax_message: aiResult.baymax_message,
    suggested_emotion:
      aiResult.suggested_emotion || (aiResult.is_scam ? "ALERT" : "HAPPY"),
    timestamp: new Date().toLocaleTimeString(),
    is_scam: aiResult.is_scam,
  };

  STM.addAlert(alertData);

  if (aiResult.is_scam) {
    LTM.saveIncident(alertData);

    io.emit("scam_alert", alertData);
  }
  //}

  res.status(200).json({ status: "success", analysis: aiResult });
});

app.get("/api/history", (req, res) => {
  const history = LTM.getAllIncidents();

  res.json({
    success: true,
    count: history.length,
    data: history,
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Hybrid Guardian Server running on http://localhost:${PORT}`);
});
