// backend/AI/ManualMode/manualHandler.js
const express = require("express");
const router = express.Router();
const fs = require("fs");

const { chatWithManualAI, clearManualHistory } = require("./manualAI");

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

// ==========================================
// 1. Manual Mode Socket.IO listener
// ==========================================
function registerManualSocket(socket, io) {
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
          });
        }

        console.log("📷 [OCR Detected Text]:", extractedText);

        const aiAnalysis = await chatWithManualAI(extractedText);

        res.json({
          extractedText: extractedText,
          analysis: aiAnalysis.message,
          timestamp: new Date().toLocaleTimeString(),
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
};
