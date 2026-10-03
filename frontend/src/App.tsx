import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
//import { EmotionState } from "./components/PixelFace";
import "./App.css";
//import CompanionView from "./views/CompanionView";
import ManualView, {
  ManualConversationSummary,
  ManualMessage,
  ManualMessageType,
} from "./views/ManualView";
import { Header } from "./components/Header";

// interface ScamAlertData {
//   text: string;
//   sender: string;
//   detected_account: string;
//   reason: string;
//   baymax_message: string;
//   // suggested_emotion: EmotionState;
//   timestamp: string;
// }

let socket: Socket;

const App: React.FC = () => {
  // const [appMode, setAppMode] = useState<"ELDERLY" | "SME">("SME");

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [blockedCount, setBlockedCount] = useState<number>(12);

  //const [chatInput, setChatInput] = useState<string>("");

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
            .findIndex(
              (m) => m.sender === "user" && m.imageUrl === localPreview,
            );
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
    <div className="canvas-root" data-mode={"SME"}>
      {/* top nav bar */}
      <Header isConnected={isConnected} />
      {/*     <header className="control-bar-wrapper">
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
          </div>*/}

      {/* top navigation bar to switch mode */}
      {/* <nav className="mode-segmented-pill">
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
      </header>*/}

      <main className="stage-viewport">
        {/* ) : ( */}
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
        {/* )} */}
      </main>
    </div>
  );
};

export default App;
