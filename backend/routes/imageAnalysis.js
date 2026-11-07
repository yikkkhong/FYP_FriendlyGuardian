const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const chatMemory = require("../memory/chatMemory");

// save temporarily uploaded images to memory
function persistUploadedImage(file, conversationId) {
  const safeName = String(file.originalname || "upload.png").replace(
    /[^\w.\-()+\s]/g,
    "_",
  );
  const destDir = path.join(chatMemory.getManualUploadRoot(), conversationId);
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

function setupImageAnalysisRoute({
  upload,
  scanImageWithLocalOCR,
  convertPdfIfNeeded,
}) {
  const router = express.Router();

  // POST /api/analyze-plain-color
  router.post(
    "/analyze-plain-color",
    upload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const originalFilePath = req.file.path;

      let convertedPngPath = null;
      let transparentImagePath = null;

      try {
        //Step 1: Convert PDF to PNG if needed
        const pdfRes = await convertPdfIfNeeded(originalFilePath);
        if (pdfRes.is_pdf) {
          convertedPngPath = pdfRes.image_path;
        }
        const imageForOcr = pdfRes.image_path;

        // Step 2: Run OCR to create a transparent image
        const ocrResult = await scanImageWithLocalOCR(imageForOcr);
        if (!ocrResult || !ocrResult.transparent_image_path) {
          throw new Error(ocrResult?.error || "OCR transparent masking failed");
        }
        transparentImagePath = ocrResult.transparent_image_path;

        const isWindows = process.platform === "win32";
        const pythonExecutable = isWindows
          ? path.join(__dirname, "../python/venv/Scripts/python.exe")
          : path.join(__dirname, "../python/venv/bin/python");

        const scriptPath = path.join(__dirname, "../python/imageAnalysis.py");

        const pyProcess = spawn(pythonExecutable, [
          scriptPath,
          transparentImagePath,
        ]);
        let stdoutData = "";

        pyProcess.stdout.on("data", (data) => {
          stdoutData += data.toString();
        });

        pyProcess.on("close", (code) => {
          // clean up temporary png file
          if (convertedPngPath && fs.existsSync(convertedPngPath)) {
            fs.unlink(convertedPngPath, () => {});
          }
          if (transparentImagePath && fs.existsSync(transparentImagePath)) {
            fs.unlink(transparentImagePath, () => {});
          }
          try {
            // Extract the last json line from python logs
            const lines = stdoutData.trim().split("\n");
            let result = null;
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.startsWith("{") && line.endsWith("}")) {
                result = JSON.parse(line);
                break;
              }
            }

            if (result) {
              // save to memory
              let conversationId =
                req.body?.conversationId ||
                chatMemory.getActiveConversationId();
              if (
                !conversationId ||
                !chatMemory.getConversation(conversationId)
              ) {
                conversationId = chatMemory.createConversation("New check").id;
              }

              const { imageUrl, imageName } = persistUploadedImage(
                req.file,
                conversationId,
              );

              // save user's text message
              const queryText = req.body?.queryText || "";
              const fallbackText = imageName
                ? `[Uploaded Screenshot: ${imageName}]`
                : "[Uploaded image]";
              const finalMessageText = queryText.trim()
                ? queryText.trim()
                : fallbackText;

              chatMemory.addMessage("user", finalMessageText, conversationId, {
                imageUrl,
                imageName,
              });

              // ai analysis result
              const riskLevel = result.isReal ? "SAFE" : "HIGH";
              const verdict = result.isReal
                ? "REAL (Physical Authentic)"
                : "AI GENERATED";
              const detail = result.isReal
                ? `Solid background pixels verified authentic (Uniform ratio: ${result.dominantRatio}%).`
                : `Background noise variance detected, matching AI generative patterns (Dominant ratio: ${result.dominantRatio}%).`;
              const rec = result.isReal
                ? "File background verified authentic."
                : "Likely AI-generated or tampered. Proceed with caution.";

              const formattedCard = `RISK LEVEL: ${riskLevel}\n\nWHY:\n- Verdict: ${verdict}\n- ${detail}\n\nRECOMMENDATION:\n- ${rec}`;

              chatMemory.addMessage(
                "assistant",
                formattedCard,
                conversationId,
                {
                  messageType: "analysis",
                },
              );

              res.json({
                success: true,
                ...result,
                conversationId,
                conversations: chatMemory.getAllConversations(),
                messages: chatMemory.toClientMessages(conversationId),
              });
            } else {
              res.status(500).json({ error: "Failed to parse Python result" });
            }
          } catch (err) {
            console.error("Parse Python stdout error:", err);
            res.status(500).json({ error: "Python execution failed" });
          }
        });
      } catch (err) {
        if (convertedPngPath && fs.existsSync(convertedPngPath)) {
          fs.unlink(convertedPngPath, () => {});
        }
        if (transparentImagePath && fs.existsSync(transparentImagePath)) {
          fs.unlink(transparentImagePath, () => {});
        }
        console.error("Image analysis pipeline error:", err);
        res.status(500).json({ error: "Image analysis failed" });
      }
    },
  );

  return router;
}

module.exports = setupImageAnalysisRoute;
