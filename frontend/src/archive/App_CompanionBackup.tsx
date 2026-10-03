// import { EmotionState } from "./components/PixelFace";
// import CompanionView from "./views/CompanionView";

import React, { useState, useEffect, useRef } from "react";
import { EmotionState } from "./components/PixelFace";
import CompanionView from "./views/CompanionView";
import { io, Socket } from "socket.io-client";
import "./companionDesign.css";

//Define a global persistent reference at the top of App.tsx (outside the component)
// to prevent it from being garbage-collected by Chrome V8
let globalUtterance: SpeechSynthesisUtterance | null = null;

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

const App_CompanionBackup: React.FC = () => {
  const [aiEmotion, setAiEmotion] = useState<EmotionState>("HAPPY");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [alertData, setAlertData] = useState<ScamAlertData | null>(null);
  const [baymaxResponse, setBaymaxResponse] = useState<string>(
    "Hello! I am Baymax, your guardian companion. You are completely safe with me.",
  );
  const [isWaitingAi, setIsWaitingAi] = useState<boolean>(false);

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [blockedCount, setBlockedCount] = useState<number>(12);

  useEffect(() => {
    socket = io("http://localhost:5000");

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("manual_list_conversations");
    });
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("scam_alert", (data: ScamAlertData) => {
      setAlertData(data);
      setShowAlert(true);
      setAiEmotion(data.suggested_emotion || "ALERT");
      const msg =
        data.baymax_message ||
        `Caution! Intercepted an anomaly from ${data.sender}`;
      setBaymaxResponse(msg);
      speakText(msg);
    });

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
    if (!("speechSynthesis" in window)) {
      console.warn("⚠️ Current browser does not support SpeechSynthesis");
      return;
    }

    try {
      window.speechSynthesis.cancel();

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      globalUtterance = utterance;

      utterance.pitch = 1.0;
      utterance.rate = 0.95;
      utterance.lang = "en-US";

      utterance.onstart = () => {
        console.log("🔊 Baymax starts speaking...");
        setIsSpeaking(true);
      };
      utterance.onend = () => {
        console.log("🔊 Baymax finished speaking...");
        setIsSpeaking(false);
        globalUtterance = null;
      };
      utterance.onerror = (e) => {
        console.error("❌ SpeechSynthesis Error:", e);
        setIsSpeaking(false);
        globalUtterance = null;
      };

      window.speechSynthesis.speak(utterance);

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (err) {
      console.error("🔥 speakText Exception:", err);
      setIsSpeaking(false);
    }
  };

  const handleSendMessage = (text: string) => {
    // moved to CompanionView handleSubmit
    // e.preventDefault();
    // if (!chatInput.trim() || isWaitingAi) return;

    setIsWaitingAi(true);
    setAiEmotion("THINKING");
    const pendingText = "Processing your query...";
    setBaymaxResponse(pendingText);

    if (socket && socket.connected) {
      socket.emit("user_chat", { text });
    } else {
      // fallback
      setTimeout(() => {
        setIsWaitingAi(false);
        setAiEmotion("NEUTRAL");
        const reply = "Server is offline, please try again later.";
        setBaymaxResponse(reply);
        speakText(reply);
      }, 1200);
    }
    //setChatInput("");
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
    <div className="canvas-root" data-mode="ELDERLY">
      {" "}
      {/*{appMode} */}
      {/* top nav bar */}
      <header className="control-bar-wrapper">
        <div className="control-bar">
          <div className="brand-group">
            <span className="brand-pill">Friendly Guardian</span>
            <div className="connection-indicator">
              <span
                className={`pulse-dot ${isConnected ? "online" : "offline"}`}
              />
              <span className="status-label">
                {isConnected ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>
        </div>
      </header>
      {/* main part */}
      <main className="stage-viewport">
        <CompanionView
          aiEmotion={aiEmotion}
          isSpeaking={isSpeaking}
          baymaxResponse={baymaxResponse}
          isWaitingAi={isWaitingAi}
          onSendMessage={handleSendMessage}
        />
      </main>
      {/* bottom panel, emotion tester */}
      {/* {appMode === "ELDERLY" && ( */}
      <footer className="footer-utility-bar">
        <div className="emotion-tuner">
          <span className="tuner-title">STATE TUNER:</span>
          <button
            onClick={() => {
              setAiEmotion("HAPPY");
              const m = "I am at your service and feeling bright!";
              setBaymaxResponse(m);
              speakText(m);
            }}
            className={`tune-chip ${aiEmotion === "HAPPY" ? "chip-active" : ""}`}
          >
            Happy
          </button>
          <button
            onClick={() => {
              setAiEmotion("NEUTRAL");
              const m = "Calm and standing by.";
              setBaymaxResponse(m);
              speakText(m);
            }}
            className={`tune-chip ${aiEmotion === "NEUTRAL" ? "chip-active" : ""}`}
          >
            Neutral
          </button>
          <button
            onClick={() => {
              setAiEmotion("THINKING");
              const m = "Processing your request...";
              setBaymaxResponse(m);
              speakText(m);
            }}
            className={`tune-chip ${aiEmotion === "THINKING" ? "chip-active" : ""}`}
          >
            Thinking
          </button>
          <button
            onClick={() => {
              setAiEmotion("ALERT");
              const m = "Attention! Security discrepancy located!";
              setBaymaxResponse(m);
              speakText(m);
            }}
            className={`tune-chip alert-chip ${aiEmotion === "ALERT" ? "chip-active" : ""}`}
          >
            Alert
          </button>
        </div>
      </footer>
      {/* )} */}
      {/* alert pop up */}
      {showAlert && alertData && (
        <div className="modal-backdrop-blur">
          <div className="tactile-alert-sheet">
            <div className="sheet-stripe" />
            <h3 className="alert-sheet-title">CRITICAL RISK INTERCEPT</h3>
            <div className="sheet-field">
              <span className="field-lbl">SUSPECT ACCOUNT</span>
              <span className="field-val">{alertData.detected_account}</span>
            </div>
            <div className="sheet-quote">“{alertData.text}”</div>
            <button onClick={handleBlock} className="safety-resolve-btn">
              BLOCK & DISMISS SENDER
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App_CompanionBackup;
