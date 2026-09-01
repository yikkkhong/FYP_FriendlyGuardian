const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

require("dotenv").config();

const { STM, LTM } = require("./securityMemory.js");
const ConversationMemory = require("./conversationMemory");

const {
  initLocalAI,
  classifyMemoryIntent_Local,
  routeConversation_Local,
} = require("./localAI");

const {
  createTimer,
  extractBankAccountRegex,
  //routeConversation_Gemini,
  classifyMemoryIntent_Gemini,
  analyzeSms_Gemini,
  chatWithAI,
  summarizeConversationHistory,
} = require("./geminiAI");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log("⚡ [Socket.IO] React Frontend Connected:", socket.id);

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

  initLocalAI();
});
