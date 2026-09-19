// backend/AI/CompanionMode/companionHandler.js
const express = require("express");
const router = express.Router();

const { STM, LTM } = require("../../memory/securityMemory");
const ConversationMemory = require("../../memory/conversationMemory");

const { initLocalAI, routeConversation_Local } = require("./localAI");

const {
  createTimer,
  extractBankAccountRegex,
  analyzeSms_Gemini,
  chatWithAI,
  summarizeConversationHistory,
} = require("./geminiAI");

// ==========================================
// 1. Companion Socket.IO logic
// ==========================================
function registerCompanionSocket(socket, io) {
  //1. cm - user chat
  socket.on("user_chat", async (data) => {
    console.log("\n💬 [User Chat]:", data.text);

    //check timing total
    const totalTimer = createTimer("TOTAL USER CHAT");
    //check timing total

    const activeConversation = ConversationMemory.getActiveConversation();
    const allConversations = ConversationMemory.getAllConversations();

    try {
      // 1. Decide which conversation to use

      const localRouterTimer = createTimer("LOCAL Conversation Router");

      const route = await routeConversation_Local(
        data.text,
        activeConversation,
        allConversations,
      );

      //const route = await routeConversation_Gemini(data.text);

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

      localRouterTimer.end();

      // 5. Save USER message
      ConversationMemory.addMessage(conversation.id, "user", data.text);

      // 6. Generate Baymax response
      const aiResponse = await chatWithAI(data.text, conversation);

      console.log("🤖 [Baymax Reply]:", aiResponse.baymax_message);
      console.log("🎭 [Emotion]:", aiResponse.suggested_emotion);

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
      const payload = {
        ...aiResponse,
        conversation_id: conversation.id,
        conversation_title: conversation.title,
      };

      socket.emit("baymax_chat_response", payload);
      console.log(
        `📤 [Socket Emit] Sent 'baymax_chat_response' to ${socket.id} (Conv: ${conversation.id})`,
      );

      //check timing total
      totalTimer.end();
      //check timing total
    } catch (error) {
      console.error("🔥 User chat processing error:", error);

      socket.emit("baymax_chat_response", {
        baymax_message: "Sorry ah, I had a little problem. Please try again.",

        suggested_emotion: "THINKING",
      });
    }
  });
}

// ==========================================
// 2. Companion Express API routes (SMS Webhook)
// ==========================================
function setupCompanionRoutes(io) {
  // 2. cm - sms webhook
  router.post("/sms-webhook", async (req, res) => {
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

    const aiResult = await analyzeSms_Gemini(text, sender);

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

  return router;
}

module.exports = {
  initLocalAI,
  registerCompanionSocket,
  setupCompanionRoutes,
};
