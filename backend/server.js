const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// OCR service (python)
const multer = require("multer");
const { execFile, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

require("dotenv").config();

// import memory
const { LTM } = require("./memory/securityMemory");

// companion mode module
const {
  initLocalAI,
  registerCompanionSocket,
  setupCompanionRoutes,
} = require("./AI/CompanionMode/companionHandler");

// manual mode module
const {
  registerManualSocket,
  setupManualRoutes,
} = require("./AI/ManualMode/manualHandler");

// INITIALIZE APP AND SERVER
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Ensure the temporary upload directory exists
const uploadDir = path.join(__dirname, "uploads");
const manualUploadDir = path.join(uploadDir, "manual");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
if (!fs.existsSync(manualUploadDir)) {
  fs.mkdirSync(manualUploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// Serve persisted Manual Mode images
app.use("/uploads", express.static(uploadDir));

const isWindows = process.platform === "win32";
const pythonExecutable = isWindows
  ? path.join(__dirname, "python/venv/Scripts/python.exe")
  : path.join(__dirname, "python/venv/bin/python");
const pythonScript = path.join(__dirname, "python/ocr_service.py");

const ocrProcess = spawn(pythonExecutable, [pythonScript], {
  stdio: ["pipe", "pipe", "inherit"], // stdin write, stdout read, stderr output
});
const ocrLineReader = readline.createInterface({ input: ocrProcess.stdout });
let pendingOcrRequests = [];

ocrLineReader.on("line", (line) => {
  try {
    const data = JSON.parse(line.trim());
    if (data.status === "READY") {
      console.log(
        "⚡ [OCR Service] PaddleOCR model loaded and ready in memory.",
      );
      return;
    }
    if (pendingOcrRequests.length > 0) {
      const resolve = pendingOcrRequests.shift();
      resolve(data);
    }
  } catch (err) {
    console.error("🔥 Error parsing OCR output:", err);
  }
});

// manual mode scan image
function scanImageWithLocalOCR(imagePath) {
  return new Promise((resolve) => {
    pendingOcrRequests.push(resolve);
    ocrProcess.stdin.write(imagePath + "\n");
  });
}

process.on("exit", () => {
  if (ocrProcess) ocrProcess.kill();
});

// use companion mode routes
app.use("/api", setupCompanionRoutes(io));

// use manual mode routes
app.use("/api", setupManualRoutes({ upload, scanImageWithLocalOCR }));

//get history api
app.get("/api/history", (req, res) => {
  const history = LTM.getAllIncidents();

  res.json({
    success: true,
    count: history.length,
    data: history,
  });
});

// socket io connection
io.on("connection", (socket) => {
  console.log("⚡ [Socket.IO] React Frontend Connected:", socket.id);

  //register companion/manual mode socket listener
  registerCompanionSocket(socket, io);
  registerManualSocket(socket, io);

  socket.on("disconnect", () => {
    console.log("❌ [Socket.IO] Frontend Disconnected");
  });
});

// start service
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Hybrid Guardian Server running on http://localhost:${PORT}`);
  initLocalAI();
});
