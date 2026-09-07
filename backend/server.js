const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

require("dotenv").config();

const { STM, LTM } = require("./securityMemory.js");
const ConversationMemory = require("./conversationMemory");

// OCR service (python)
const multer = require("multer");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

// Ensure the temporary upload directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

const {
  initLocalAI,
  classifyMemoryIntent_Local,
  routeConversation_Local,
} = require("./AI/CompanionMode/localAI");

const {
  createTimer,
  extractBankAccountRegex,
  routeConversation_Gemini,
  classifyMemoryIntent_Gemini,
  analyzeSms_Gemini,
  chatWithAI,
  summarizeConversationHistory,
} = require("./AI/CompanionMode/geminiAI");

const {
  chatWithManualAI,
  clearManualHistory,
} = require("./AI/ManualMode/manualAI");

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

  // ==========================================
  //  Manual Mode
  // ==========================================
  socket.on("manual_chat", async (data) => {
    console.log("\n🔍 [Manual Mode Chat]:", data.text);

    try {
      // Call the manual AI chat function
      const result = await chatWithManualAI(data.text);

      socket.emit("manual_chat_response", {
        message: result.message,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error("🔥 Manual chat error:", err);
      socket.emit("manual_chat_response", {
        message: "Failed to process message in manual mode.",
      });
    }
  });

  socket.on("manual_clear_history", () => {
    clearManualHistory();
    console.log("🧹 Manual Mode history cleared.");
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

// Manual mode upload image OCR + Gemini analyse
app.post("/api/manual-scan-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided." });
  }

  const imagePath = req.file.path;
  const pythonScript = path.join(__dirname, "python/ocr_service.py");

  // Get venv path
  const isWindows = process.platform === "win32";
  const pythonExecutable = isWindows
    ? path.join(__dirname, "python/venv/Scripts/python.exe") // Windows venv
    : path.join(__dirname, "python/venv/bin/python"); // Mac / Linux venv

  // 1. Get Python - execute PP-OCR
  execFile(
    pythonExecutable,
    [pythonScript, imagePath],
    { encoding: "utf8" },
    async (error, stdout) => {
      // prevent accumulation
      fs.unlink(imagePath, () => {});

      if (error) {
        console.error("🔥 OCR Execution Error:", error);
        return res.status(500).json({ error: "Failed to process image OCR." });
      }

      try {
        // 2. Get Python {"text": "..."}
        const ocrResult = JSON.parse(stdout.trim());
        const extractedText = ocrResult.text;

        if (!extractedText) {
          return res.json({
            extractedText: "",
            message: "No readable text detected in this image.",
          });
        }

        console.log("📷 [OCR Detected Text]:", extractedText);

        // 3. send detected text to gemini (use manualAI)
        const aiAnalysis = await chatWithManualAI(extractedText);

        // 4. return OCR text Gemini analysed result
        res.json({
          extractedText: extractedText,
          analysis: aiAnalysis.message,
          timestamp: new Date().toLocaleTimeString(),
        });
      } catch (parseErr) {
        console.error("🔥 JSON Parse / Gemini Error:", parseErr);
        res.status(500).json({ error: "Failed to analyze extracted text." });
      }
    },
  );
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
