import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { EmotionState } from "./components/PixelFace";
import "./App.css";
import CompanionView from "./views/CompanionView";
import ManualView, {
  ManualConversationSummary,
  ManualMessage,
  ManualMessageType,
} from "./views/ManualView";

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

//Define a global persistent reference at the top of App.tsx (outside the component)
// to prevent it from being garbage-collected by Chrome V8
let globalUtterance: SpeechSynthesisUtterance | null = null;

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<"ELDERLY" | "SME">("SME");
  const [aiEmotion, setAiEmotion] = useState<EmotionState>("HAPPY");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [alertData, setAlertData] = useState<ScamAlertData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [blockedCount, setBlockedCount] = useState<number>(12);

  //const [chatInput, setChatInput] = useState<string>("");
  const [baymaxResponse, setBaymaxResponse] = useState<string>(
    "Hello! I am Baymax, your guardian companion. You are completely safe with me.",
  );
  const [isWaitingAi, setIsWaitingAi] = useState<boolean>(false);

  // Manual Mode
  const [manualMessages, setManualMessages] = useState<ManualMessage[]>([]);
  const [isManualLoading, setIsManualLoading] = useState<boolean>(false);
  const [manualConversations, setManualConversations] = useState<
    ManualConversationSummary[]
  >([]);
  const [activeManualConversationId, setActiveManualConversationId] = useState<
    string | null
  >(null);
  const activeManualConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeManualConversationIdRef.current = activeManualConversationId;
  }, [activeManualConversationId]);

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

    //manual mode
    socket.on(
      "manual_conversations",
      (data: {
        conversations: ManualConversationSummary[];
        activeConversationId: string | null;
        messages: ManualMessage[];
      }) => {
        setManualConversations(data.conversations || []);
        setActiveManualConversationId(data.activeConversationId);
        setManualMessages(data.messages || []);
      },
    );

    socket.on(
      "manual_conversation_created",
      (data: {
        conversations: ManualConversationSummary[];
        activeConversationId: string;
        messages: ManualMessage[];
      }) => {
        setManualConversations(data.conversations || []);
        setActiveManualConversationId(data.activeConversationId);
        setManualMessages(data.messages || []);
        setIsManualLoading(false);
      },
    );

    socket.on(
      "manual_conversation_switched",
      (data: {
        conversations: ManualConversationSummary[];
        activeConversationId: string;
        messages: ManualMessage[];
      }) => {
        setManualConversations(data.conversations || []);
        setActiveManualConversationId(data.activeConversationId);
        setManualMessages(data.messages || []);
        setIsManualLoading(false);
      },
    );

    socket.on(
      "manual_chat_response",
      (data: {
        message: string;
        messageType?: ManualMessageType;
        timestamp?: string;
        conversationId?: string | null;
        title?: string;
        conversations?: ManualConversationSummary[];
      }) => {
        const currentId = activeManualConversationIdRef.current;
        if (
          data.conversationId &&
          currentId &&
          data.conversationId !== currentId
        ) {
          if (data.conversations) {
            setManualConversations(data.conversations);
          }
          setIsManualLoading(false);
          return;
        }

        setManualMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: data.message,
            messageType: data.messageType,
            time: data.timestamp || new Date().toLocaleTimeString(),
          },
        ]);
        if (data.conversations) {
          setManualConversations(data.conversations);
        }
        if (data.conversationId) {
          setActiveManualConversationId(data.conversationId);
        }
        setIsManualLoading(false);
      },
    );

    socket.on(
      "manual_conversation_renamed",
      (data: {
        conversations: ManualConversationSummary[];
        activeConversationId: string | null;
      }) => {
        setManualConversations(data.conversations || []);
        if (data.activeConversationId !== undefined) {
          setActiveManualConversationId(data.activeConversationId);
        }
      },
    );

    socket.on(
      "manual_conversation_deleted",
      (data: {
        conversations: ManualConversationSummary[];
        activeConversationId: string | null;
        messages: ManualMessage[];
      }) => {
        setManualConversations(data.conversations || []);
        setActiveManualConversationId(data.activeConversationId);
        setManualMessages(data.messages || []);
        setIsManualLoading(false);
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

  const handleNewManualConversation = () => {
    if (!socket || !socket.connected) return;
    setIsManualLoading(false);
    socket.emit("manual_new_conversation");
  };

  const handleSelectManualConversation = (conversationId: string) => {
    if (
      !socket ||
      !socket.connected ||
      conversationId === activeManualConversationId
    )
      return;
    socket.emit("manual_switch_conversation", { conversationId });
  };

  const handleRenameManualConversation = (
    conversationId: string,
    title: string,
  ) => {
    if (!socket || !socket.connected) return;
    socket.emit("manual_rename_conversation", { conversationId, title });
  };

  const handleDeleteManualConversation = (conversationId: string) => {
    if (!socket || !socket.connected) return;
    socket.emit("manual_delete_conversation", { conversationId });
  };

  const handleSendManualMessage = (text: string) => {
    const conversationId = activeManualConversationId;

    setIsManualLoading(true);
    setManualMessages((prev) => [
      ...prev,
      { sender: "user", text, time: new Date().toLocaleTimeString() },
    ]);

    if (socket && socket.connected) {
      socket.emit("manual_chat", {
        text,
        conversationId: conversationId || undefined,
      });
    } else {
      setIsManualLoading(false);
      setManualMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Server is offline, please check your connection.",
          messageType: "general",
          time: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  const handleUploadImage = async (file: File) => {
    setIsManualLoading(true);

    const conversationId = activeManualConversationId;
    const localPreview = URL.createObjectURL(file);

    setManualMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: "",
        imageUrl: localPreview,
        imageName: file.name,
        time: new Date().toLocaleTimeString(),
      },
    ]);

    const formData = new FormData();
    formData.append("image", file);
    if (conversationId) {
      formData.append("conversationId", conversationId);
    }

    try {
      const res = await fetch("http://localhost:5000/api/manual-scan-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.conversations) {
        setManualConversations(data.conversations);
      }
      if (data.conversationId) {
        setActiveManualConversationId(data.conversationId);
      }

      // Prefer server-synced message list (includes persistent image URL)
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        setManualMessages(data.messages);
      } else if (data.analysis) {
        setManualMessages((prev) => {
          const next = [...prev];
          const lastUserIdx = [...next]
            .reverse()
            .findIndex((m) => m.sender === "user" && m.imageUrl === localPreview);
          if (lastUserIdx !== -1) {
            const idx = next.length - 1 - lastUserIdx;
            next[idx] = {
              ...next[idx],
              imageUrl: data.imageUrl || next[idx].imageUrl,
              imageName: data.imageName || next[idx].imageName,
            };
          }
          next.push({
            sender: "ai",
            text: data.analysis,
            messageType: data.messageType || "analysis",
            time: data.timestamp || new Date().toLocaleTimeString(),
          });
          return next;
        });
      }
    } catch (err) {
      console.error("Image upload failed:", err);
      setManualMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i].imageUrl === localPreview) {
            next[i] = {
              ...next[i],
              imageUrl: undefined,
              text: `[Upload failed: ${file.name}]`,
            };
            break;
          }
        }
        next.push({
          sender: "ai",
          text: "Failed to upload or inspect image. Please try again.",
          messageType: "general",
          time: new Date().toLocaleTimeString(),
        });
        return next;
      });
    } finally {
      URL.revokeObjectURL(localPreview);
      setIsManualLoading(false);
    }
  };

  return (
    <div className="canvas-root" data-mode={appMode}>
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

          {/* top navigation bar to switch mode */}
          <nav className="mode-segmented-pill">
            <button
              onClick={() => setAppMode("ELDERLY")}
              className={`segment-btn ${appMode === "ELDERLY" ? "selected" : ""}`}
            >
              Companion
            </button>
            <button
              onClick={() => {
                setAppMode("SME");
                if (socket && socket.connected) {
                  socket.emit("manual_list_conversations");
                }
              }}
              className={`segment-btn ${appMode === "SME" ? "selected" : ""}`}
            >
              Manual
            </button>
          </nav>
        </div>
      </header>

      {/* main part */}
      <main className="stage-viewport">
        {appMode === "ELDERLY" ? (
          <CompanionView
            aiEmotion={aiEmotion}
            isSpeaking={isSpeaking}
            baymaxResponse={baymaxResponse}
            isWaitingAi={isWaitingAi}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <ManualView
            blockedCount={blockedCount}
            messages={manualMessages}
            isLoading={isManualLoading}
            conversations={manualConversations}
            activeConversationId={activeManualConversationId}
            onSendMessage={handleSendManualMessage}
            onUploadImage={handleUploadImage}
            onNewConversation={handleNewManualConversation}
            onSelectConversation={handleSelectManualConversation}
            onRenameConversation={handleRenameManualConversation}
            onDeleteConversation={handleDeleteManualConversation}
          />
        )}
      </main>

      {/* bottom panel, emotion tester */}
      {appMode === "ELDERLY" && (
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
      )}

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

export default App;
