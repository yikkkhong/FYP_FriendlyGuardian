// backend/AI/ManualMode/manualHandler.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

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

function emitConversationState(socket, extra = {}) {
  const activeId = chatMemory.getActiveConversationId();
  socket.emit("manual_conversations", {
    conversations: chatMemory.getAllConversations(),
    activeConversationId: activeId,
    messages: activeId ? chatMemory.toClientMessages(activeId) : [],
    ...extra,
  });
}

function persistUploadedImage(file, conversationId) {
  const safeName = String(file.originalname || "upload.png").replace(
    /[^\w.\-()+\s]/g,
    "_",
  );
  const destDir = path.join(
    chatMemory.getManualUploadRoot(),
    conversationId,
  );
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const filename = `${Date.now()}-${safeName}`;
  const destPath = path.join(destDir, filename);

  try {
    fs.renameSync(file.path, destPath);
  } catch {
    fs.copyFileSync(file.path, destPath);
    fs.unlink(file.path, () => {});
  }

  const imageUrl = `/uploads/manual/${conversationId}/${filename}`;
  return { destPath, imageUrl, imageName: file.originalname || safeName };
}

// ==========================================
// 1. Manual Mode Socket.IO listener
// ==========================================
function registerManualSocket(socket, io) {
  socket.on("manual_list_conversations", () => {
    emitConversationState(socket);
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

  socket.on("manual_rename_conversation", (data) => {
    const conversationId = data?.conversationId;
    const title = data?.title;
    const conversation = chatMemory.renameConversation(conversationId, title);
    if (!conversation) {
      socket.emit("manual_conversation_error", {
        error: "Could not rename conversation.",
      });
      return;
    }

    socket.emit("manual_conversation_renamed", {
      conversationId: conversation.id,
      title: conversation.title,
      conversations: chatMemory.getAllConversations(),
      activeConversationId: chatMemory.getActiveConversationId(),
    });
  });

  socket.on("manual_delete_conversation", (data) => {
    const conversationId = data?.conversationId;
    if (!conversationId) return;

    clearManualHistory(conversationId);
    console.log(`🗑️ [Manual] Deleted conversation: ${conversationId}`);

    const activeId = chatMemory.getActiveConversationId();
    socket.emit("manual_conversation_deleted", {
      deletedId: conversationId,
      conversations: chatMemory.getAllConversations(),
      activeConversationId: activeId,
      messages: activeId ? chatMemory.toClientMessages(activeId) : [],
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
        messageType: result.messageType,
        timestamp: new Date().toLocaleTimeString(),
        conversationId: result.conversationId,
        title: result.title,
        conversations: chatMemory.getAllConversations(),
      });
    } catch (err) {
      console.error("🔥 Manual chat error:", err);
      socket.emit("manual_chat_response", {
        message: "Failed to process message in manual mode.",
        messageType: "general",
        conversationId: data.conversationId || null,
      });
    }
  });

  socket.on("manual_clear_history", (data) => {
    clearManualHistory(data?.conversationId || null);
    console.log("🧹 Manual Mode history cleared.");
    emitConversationState(socket);
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

      let conversationId =
        req.body?.conversationId || chatMemory.getActiveConversationId();

      if (!conversationId) {
        conversationId = chatMemory.createConversation("New check").id;
      } else if (!chatMemory.getConversation(conversationId)) {
        conversationId = chatMemory.createConversation("New check").id;
      } else {
        chatMemory.switchConversation(conversationId);
      }

      const timer = createTimer("AI Analyse Image Time");

      try {
        // OCR from temp multer path first, then move to persistent location
        const tempPath = req.file.path;
        const ocrResult = await scanImageWithLocalOCR(tempPath);

        const { imageUrl, imageName } = persistUploadedImage(
          req.file,
          conversationId,
        );

        const extractedText = ocrResult.text || "";

        // Store user image message (visible in history)
        chatMemory.addMessage(
          "user",
          imageName ? `[Uploaded Screenshot: ${imageName}]` : "[Uploaded image]",
          conversationId,
          {
            imageUrl,
            imageName,
            ocrText: extractedText || undefined,
          },
        );

        if (!extractedText) {
          const noTextMsg =
            "No readable text detected in this image. Try a clearer screenshot.";
          chatMemory.addMessage("assistant", noTextMsg, conversationId, {
            messageType: "general",
          });

          return res.json({
            extractedText: "",
            analysis: noTextMsg,
            messageType: "general",
            timestamp: new Date().toLocaleTimeString(),
            conversationId,
            imageUrl,
            imageName,
            conversations: chatMemory.getAllConversations(),
            messages: chatMemory.toClientMessages(conversationId),
          });
        }

        console.log("📷 [OCR Detected Text]:", extractedText);

        const aiAnalysis = await chatWithManualAI(
          extractedText,
          conversationId,
          {
            forcedType: "analysis",
            skipUserPersist: true,
          },
        );

        res.json({
          extractedText,
          analysis: aiAnalysis.message,
          messageType: aiAnalysis.messageType || "analysis",
          timestamp: new Date().toLocaleTimeString(),
          conversationId: aiAnalysis.conversationId,
          title: aiAnalysis.title,
          imageUrl,
          imageName,
          conversations: chatMemory.getAllConversations(),
          messages: chatMemory.toClientMessages(aiAnalysis.conversationId),
        });

        timer.end();
      } catch (parseErr) {
        // Clean up temp file if still present
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlink(req.file.path, () => {});
        }
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
};
