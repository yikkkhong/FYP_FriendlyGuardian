// backend/AI/ManualMode/manualHandler.js
const express = require("express");
const router = express.Router();
const fs = require("fs");

const { chatWithManualAI, clearManualHistory } = require("./manualAI");
const chatMemory = require("../../memory/chatMemory");

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

function mapConversationPayload(conversation) {
  if (!conversation) return null;
  return {
    id: conversation.id,
    title: conversation.title,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
    messages: chatMemory.toClientMessages(conversation.id),
  };
}

// ==========================================
// 1. Manual Mode Socket.IO listener
// ==========================================
function registerManualSocket(socket, io) {
  socket.on("manual_list_conversations", () => {
    const activeId = chatMemory.getActiveConversationId();
    socket.emit("manual_conversations", {
      conversations: chatMemory.getAllConversations(),
      activeConversationId: activeId,
      messages: chatMemory.toClientMessages(activeId),
    });
  });

  socket.on("manual_new_conversation", () => {
    const conversation = chatMemory.createConversation("New check");
    socket.emit("manual_conversation_created", {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        message_count: 0,
        preview: "",
      },
      conversations: chatMemory.getAllConversations(),
      activeConversationId: conversation.id,
      messages: [],
    });
  });

  socket.on("manual_switch_conversation", (data) => {
    const conversationId = data?.conversationId;
    const conversation = chatMemory.switchConversation(conversationId);
    if (!conversation) {
      socket.emit("manual_conversation_error", {
        error: "Conversation not found.",
      });
      return;
    }

    socket.emit("manual_conversation_switched", {
      activeConversationId: conversation.id,
      messages: chatMemory.toClientMessages(conversation.id),
      conversations: chatMemory.getAllConversations(),
    });
  });

  socket.on("manual_chat", async (data) => {
    console.log("\n🔍 [Manual Mode Chat]:", data.text);

    try {
      const result = await chatWithManualAI(
        data.text,
        data.conversationId || null,
      );

      socket.emit("manual_chat_response", {
        message: result.message,
        timestamp: new Date().toLocaleTimeString(),
        conversationId: result.conversationId,
        title: result.title,
        conversations: chatMemory.getAllConversations(),
      });
    } catch (err) {
      console.error("🔥 Manual chat error:", err);
      socket.emit("manual_chat_response", {
        message: "Failed to process message in manual mode.",
        conversationId: data.conversationId || null,
      });
    }
  });

  socket.on("manual_clear_history", (data) => {
    clearManualHistory(data?.conversationId || null);
    console.log("🧹 Manual Mode history cleared.");
    const activeId = chatMemory.getActiveConversationId();
    socket.emit("manual_conversations", {
      conversations: chatMemory.getAllConversations(),
      activeConversationId: activeId,
      messages: activeId ? chatMemory.toClientMessages(activeId) : [],
    });
  });
}

// ==========================================
// 2. Manual Mode Express API routes (ocr + analyse)
// ==========================================
function setupManualRoutes({ upload, scanImageWithLocalOCR }) {
  router.post(
    "/manual-scan-image",
    upload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided." });
      }

      const imagePath = req.file.path;
      const conversationId = req.body?.conversationId || null;
      const timer = createTimer("AI Analyse Image Time");

      try {
        const ocrResult = await scanImageWithLocalOCR(imagePath);
        fs.unlink(imagePath, () => {});

        const extractedText = ocrResult.text;

        if (!extractedText) {
          return res.json({
            extractedText: "",
            analysis: "No readable text detected in this image.",
            timestamp: new Date().toLocaleTimeString(),
            conversationId,
          });
        }

        console.log("📷 [OCR Detected Text]:", extractedText);

        const aiAnalysis = await chatWithManualAI(
          extractedText,
          conversationId,
        );

        res.json({
          extractedText: extractedText,
          analysis: aiAnalysis.message,
          timestamp: new Date().toLocaleTimeString(),
          conversationId: aiAnalysis.conversationId,
          title: aiAnalysis.title,
          conversations: chatMemory.getAllConversations(),
        });

        timer.end();
      } catch (parseErr) {
        fs.unlink(imagePath, () => {});
        console.error("🔥 JSON Parse / Gemini Error:", parseErr);
        res.status(500).json({ error: "Failed to analyze extracted text." });
      }
    },
  );

  return router;
}

module.exports = {
  registerManualSocket,
  setupManualRoutes,
  mapConversationPayload,
};
