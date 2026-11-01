const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

function setupImageAnalysisRoute(upload) {
  const router = express.Router();

  // POST /api/analyze-plain-color
  router.post("/analyze-plain-color", upload.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const filePath = req.file.path;
    const isWindows = process.platform === "win32";
    const pythonExecutable = isWindows
      ? path.join(__dirname, "../python/venv/Scripts/python.exe")
      : path.join(__dirname, "../python/venv/bin/python");

    const scriptPath = path.join(__dirname, "../python/imageAnalysis.py");

    const pyProcess = spawn(pythonExecutable, [scriptPath, filePath]);
    let stdoutData = "";

    pyProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    pyProcess.on("close", (code) => {
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
          res.json({ success: true, ...result });
        } else {
          res.status(500).json({ error: "Failed to parse Python result" });
        }
      } catch (err) {
        console.error("Parse Python stdout error:", err);
        res.status(500).json({ error: "Python execution failed" });
      }
    });
  });

  return router;
}

module.exports = setupImageAnalysisRoute;
