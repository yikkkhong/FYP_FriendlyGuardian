const { spawn } = require("child_process");
const path = require("path");
const readline = require("readline");

// 1. Analyzing Python Virtual Environment Paths and Engine Script Paths
const isWindows = process.platform === "win32";
const pythonExecutable = isWindows
  ? path.join(__dirname, "../python/venv/Scripts/python.exe")
  : path.join(__dirname, "../python/venv/bin/python");
const engineScript = path.join(__dirname, "../python/local_ai_engine.py");

// 2. Launch a memory-resident local Python AI engine
const aiProcess = spawn(pythonExecutable, [engineScript], {
  stdio: ["pipe", "pipe", "inherit"],
});

const lineReader = readline.createInterface({
  input: aiProcess.stdout,
});

const pendingQueue = [];

lineReader.on("line", (line) => {
  try {
    const data = JSON.parse(line.trim());
    if (data.status === "READY") {
      console.log(
        "⚡ [Local AI Engine] Qwen2.5-0.5B-Instruct loaded in CPU memory.",
      );
      return;
    }

    if (pendingQueue.length > 0) {
      const { resolve, reject } = pendingQueue.shift();
      if (data.ok) {
        resolve(data.result);
      } else {
        reject(new Error(data.error || "Local AI task failed"));
      }
    }
  } catch (err) {
    console.error("🔥 [Local AI Bridge] Output parse error:", err);
  }
});

/**
 * General-purpose invocation interface: Send tasks to a local Python model
 * @param {string} task - task type (such as "speech" or "fallback")
 * @param {object} payload - additional information (like { text: "..." })
 */
function runLocalAITask(task, payload = {}) {
  return new Promise((resolve, reject) => {
    pendingQueue.push({ resolve, reject });
    const message = JSON.stringify({ task, ...payload });
    aiProcess.stdin.write(message + "\n");
  });
}

function correctSpeechText(rawText) {
  return runLocalAITask("speech", { text: rawText });
}

// to use when offline / api got problem
function analyzeScamOffline(rawText, matchedPhone = null) {
  return runLocalAITask("scam_fallback", {
    text: rawText,
    matchedPhone,
  });
}

process.on("exit", () => {
  if (aiProcess) aiProcess.kill();
});

module.exports = {
  runLocalAITask,
  correctSpeechText,
  analyzeScamOffline, // [ADDED]
};
