import React, { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { PixelFace, EmotionState } from "./components/PixelFace";
import "./App.css";

// notification message data structure
interface ScamAlertData {
  text: string;
  sender: string;
  detected_account: string;
  reason: string;
  baymax_message: string;
  suggested_emotion: EmotionState;
  timestamp: string;
}

let socket: Socket;

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<"ELDERLY" | "SME">("ELDERLY");
  const [aiEmotion, setAiEmotion] = useState<EmotionState>("HAPPY");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [alertData, setAlertData] = useState<ScamAlertData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [blockedCount, setBlockedCount] = useState<number>(12);

  const [chatInput, setChatInput] = useState<string>("");
  const [baymaxResponse, setBaymaxResponse] = useState<string>(
    "Hello! I am your Guardian Friend Baymax. You are safe with me!",
  );
  const [isWaitingAi, setIsWaitingAi] = useState<boolean>(false);

  // Connect to Node.js backend Socket.IO service
  useEffect(() => {
    socket = io("http://localhost:5000");

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    // real-time scam alerts - incoming SMS
    socket.on("scam_alert", (data: ScamAlertData) => {
      setAlertData(data);
      setShowAlert(true);
      setAiEmotion(data.suggested_emotion || "ALERT");

      const messageToSay =
        data.baymax_message || `DANGER! Intercepted scam from ${data.sender}!`;
      setBaymaxResponse(messageToSay);
      speakText(messageToSay);
    });

    // real-time chat response from Gemini AI
    socket.on(
      "baymax_chat_response",
      (data: { baymax_message: string; suggested_emotion: EmotionState }) => {
        setBaymaxResponse(data.baymax_message);
        setAiEmotion(data.suggested_emotion || "HAPPY");
        speakText(data.baymax_message);
        setIsWaitingAi(false);
      },
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 0.95;
      utterance.rate = 0.9;

      utterance.onstart = () => setIsSpeaking(true);

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isWaitingAi) return;

    setIsWaitingAi(true);
    setAiEmotion("THINKING");
    setBaymaxResponse("Thinking...");

    socket.emit("user_chat", { text: chatInput });
    setChatInput("");
  };

  const handleBlock = () => {
    setShowAlert(false);
    setBlockedCount((prev) => prev + 1);
    setAiEmotion("HAPPY");
    const msg = "Threat blocked! You are safe now. What else can I do for you?";
    setBaymaxResponse(msg);
    speakText(msg);
  };

  return (
    <div className="app-container">
      {/* header */}
      <header className="header">
        <div className="logo-section">
          <h2>🛡️ Friendly Guardian</h2>
          <span className={`status-tag ${isConnected ? "online" : "offline"}`}>
            {isConnected ? "● Connected" : "○ Offline"}
          </span>
        </div>

        <div className="mode-toggle">
          <button
            onClick={() => setAppMode("ELDERLY")}
            className={`toggle-btn ${appMode === "ELDERLY" ? "active" : ""}`}
          >
            👵 Companion Mode
          </button>
          <button
            onClick={() => setAppMode("SME")}
            className={`toggle-btn ${appMode === "SME" ? "active" : ""}`}
          >
            🏢 SME Mode
          </button>
        </div>
      </header>

      {appMode === "ELDERLY" && (
        <main className="companion-hero-container">
          {/* 320x320 Pixel */}
          <PixelFace emotion={aiEmotion} isSpeaking={isSpeaking} />

          {/* dialog box */}
          <div className="speech-bubble">
            <h3 className="speech-text">"{baymaxResponse}"</h3>
            <p className="speech-subtext">
              {isWaitingAi
                ? "Baymax is thinking..."
                : isSpeaking
                  ? "Baymax is speaking..."
                  : "Baymax - Your AI Protection Friend"}
            </p>
          </div>

          {/* input field */}
          <form onSubmit={handleSendMessage} className="chat-input-form">
            <input
              type="text"
              placeholder="Ask Baymax anything... (e.g. 'Is it safe?')"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="chat-input"
              disabled={isWaitingAi}
            />
            <button
              type="submit"
              className="chat-submit-btn"
              disabled={isWaitingAi}
            >
              {isWaitingAi ? "..." : "Talk"}
            </button>
          </form>

          {/* test emotion panel */}
          <div className="debug-control-panel">
            <span className="control-title">Emotion Test Panel</span>
            <div className="emotion-btn-row">
              <button
                onClick={() => {
                  setAiEmotion("HAPPY");
                  setBaymaxResponse("I am happy to protect you!");
                }}
                className="btn"
              >
                😊 Happy
              </button>
              <button
                onClick={() => {
                  setAiEmotion("NEUTRAL");
                  setBaymaxResponse("Monitoring in background.");
                }}
                className="btn"
              >
                😐 Neutral
              </button>
              <button
                onClick={() => {
                  setAiEmotion("THINKING");
                  setBaymaxResponse("Checking security rules...");
                }}
                className="btn"
              >
                🤔 Thinking
              </button>
              <button
                onClick={() => {
                  setAiEmotion("ALERT");
                  setBaymaxResponse("⚠️ Warning! Scam threat detected!");
                }}
                className="btn alert-btn"
              >
                ⚠️ Alert
              </button>
            </div>
          </div>
        </main>
      )}

      {/* 2. SME Mode */}
      {appMode === "SME" && (
        <main className="sme-container">
          <div className="sme-header-card">
            <h3>🏢 Enterprise Risk & Transaction Monitor</h3>
            <p style={{ color: "#9CA3AF", marginTop: "8px", fontSize: "14px" }}>
              Real-time threat intelligence and mule account pattern detection
              for business communications.
            </p>
          </div>

          <div className="sme-stats-grid">
            <div className="stat-card">
              <span className="stat-label">TOTAL SMS PROCESSED</span>
              <span className="stat-value blue">1,248</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">SCAM THREATS BLOCKED</span>
              <span className="stat-value red">{blockedCount}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">FLAGGED MULE ACCOUNTS</span>
              <span className="stat-value green">8</span>
            </div>
          </div>
        </main>
      )}

      {/* 3. Scam Alert Popup */}
      {showAlert && alertData && (
        <div className="modal-overlay">
          <div className="alert-card">
            <h2 className="alert-title">⚠️ SCAM WARNING!</h2>
            <p style={{ fontSize: "14px", color: "#D1D5DB" }}>
              Detected Account:{" "}
              <strong className="highlight">
                {alertData.detected_account}
              </strong>
            </p>
            <div className="raw-msg">"{alertData.text}"</div>
            <button onClick={handleBlock} className="dismiss-btn">
              BLOCK SENDER & DISMISS
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
