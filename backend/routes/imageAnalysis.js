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

function setupImageAnalysisRoute(upload, scanImageWithLocalOCR) {
  const router = express.Router();

  // POST /api/analyze-plain-color
  router.post(
    "/analyze-plain-color",
    upload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const filePath = req.file.path;

      try {
        // =========================================================
        // STEP 1: 先呼叫 OCR 常驻进程，执行文字定位与透明化
        // =========================================================
        const ocrResult = await scanImageWithLocalOCR(filePath);

        // 确保 ocr_service.py 成功返回了透明图的路径
        if (!ocrResult || !ocrResult.transparent_image_path) {
          console.error("OCR transparent masking failed", ocrResult);
          return res
            .status(500)
            .json({ error: "Failed to generate transparent background mask." });
        }

        const transparentImagePath = ocrResult.transparent_image_path;

        // =========================================================
        // STEP 2: 把去除了文字的【透明图】交给 imageAnalysis.py 测底色
        // =========================================================
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
          try {
            // 清理 OCR 产生的临时透明图片，节省硬盘空间
            if (fs.existsSync(transparentImagePath)) {
              fs.unlink(transparentImagePath, () => {});
            }

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
        console.error("Pipeline error:", err);
        res.status(500).json({ error: "Pipeline execution failed" });
      }
    },
  );

  return router;
}

module.exports = setupImageAnalysisRoute;
