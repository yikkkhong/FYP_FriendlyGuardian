// ---- Old code before load model from other script ----
// ---- keep it as speech corrector not very accurate ----
// ---- need to improve in future ----

// const express = require("express");
// const { spawn } = require("child_process");
// const path = require("path");
// const readline = require("readline");

// const router = express.Router();

// // 1. Resolve Python executable and script paths
// const isWindows = process.platform === "win32";
// const pythonExecutable = isWindows
//   ? path.join(__dirname, "../python/venv/Scripts/python.exe")
//   : path.join(__dirname, "../python/venv/bin/python");
// const speechScript = path.join(__dirname, "../python/speech_corrector.py");

// // 2. Spawn the Python process using stdin/stdout pipes
// const speechProcess = spawn(pythonExecutable, [speechScript], {
//   stdio: ["pipe", "pipe", "inherit"],
// });

// const speechLineReader = readline.createInterface({
//   input: speechProcess.stdout,
// });
// const pendingRequests = [];

// speechLineReader.on("line", (line) => {
//   try {
//     const data = JSON.parse(line.trim());
//     if (data.status === "READY") {
//       console.log(
//         "⚡ [Speech Service] Qwen correction model loaded in memory.",
//       );
//       return;
//     }
//     if (pendingRequests.length > 0) {
//       const resolve = pendingRequests.shift();
//       resolve(data.corrected_text);
//     }
//   } catch (err) {
//     console.error("🔥 Error parsing Speech Corrector output:", err);
//   }
// });

// function correctSpeechText(rawText) {
//   return new Promise((resolve) => {
//     pendingRequests.push(resolve);
//     // Replace newlines with spaces to avoid breaking stdin lines
//     const sanitized = rawText.replace(/[\r\n]+/g, " ");
//     speechProcess.stdin.write(sanitized + "\n");
//   });
// }

// // Ensure Python sub-process is cleaned up on server shutdown
// process.on("exit", () => {
//   if (speechProcess) speechProcess.kill();
// });

// // 3. Define the correction route: POST /api/correct-speech
// router.post("/correct-speech", async (req, res) => {
//   const { rawText } = req.body;
//   if (!rawText || !rawText.trim()) {
//     return res.json({ correctedText: "" });
//   }

//   try {
//     const correctedText = await correctSpeechText(rawText);
//     return res.json({ correctedText });
//   } catch (err) {
//     console.error("Speech correction failed, fallback to original text:", err);
//     return res.json({ correctedText: rawText });
//   }
// });

// module.exports = router;

// ---- New code ----

const express = require("express");
const router = express.Router();

const { correctSpeechText } = require("../AI/localAiBridge");

// Define the correction route: POST /api/correct-speech
router.post("/correct-speech", async (req, res) => {
  const { rawText } = req.body;
  if (!rawText || !rawText.trim()) {
    return res.json({ correctedText: "" });
  }

  try {
    const correctedText = await correctSpeechText(rawText);
    return res.json({ correctedText });
  } catch (err) {
    console.error("Speech correction failed, fallback to original text:", err);
    return res.json({ correctedText: rawText });
  }
});

module.exports = router;
