import React, { useState, useRef, useEffect } from "react";
import ThreatReportCard, {
  parseReport,
} from "../components/scam/ThreatReportCard";
import VoiceInputButton, {
  VoiceInputHandle,
} from "../components/common/VoiceInputButton";
import useTextToSpeech from "../hooks/useTextToSpeech";
import FormattedMessage, {
  AiResponseCard,
} from "../components/scam/AiResponseCard";
import {
  MoreIcon,
  GuardianMark,
  PhoneIcon,
  CameraIcon,
  MenuIcon,
  CloseIcon,
} from "../components/icons/Icons";
import ConfirmModal from "../components/common/ConfirmModal";
import ChatEmptyState from "../components/chat/ChatEmptyState";
import ChatMessageList from "../components/chat/ChatMessageList";
import ChatComposer, {
  ChatComposerHandle,
} from "../components/chat/ChatComposer";

export type ManualMessageType = "analysis" | "follow_up" | "general";

export interface ManualMessage {
  sender: "user" | "ai";
  text: string;
  time: string;
  imageUrl?: string;
  imageName?: string;
  messageType?: ManualMessageType;
}

export interface ManualConversationSummary {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
  preview?: string;
}

interface ManualViewProps {
  blockedCount: number;
  messages: ManualMessage[];
  isLoading: boolean;
  conversations: ManualConversationSummary[];
  activeConversationId: string | null;
  onSendMessage: (message: string) => void;
  onUploadImage: (file: File) => void;
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onDeleteConversation: (conversationId: string) => void;
}

// // below this
const API_ORIGIN = "http://localhost:5000";

// function resolveImageUrl(url?: string) {
//   if (!url) return undefined;
//   if (
//     url.startsWith("http://") ||
//     url.startsWith("https://") ||
//     url.startsWith("blob:")
//   ) {
//     return url;
//   }
//   return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
// }

export const ManualView: React.FC<ManualViewProps> = ({
  messages,
  isLoading,
  conversations,
  activeConversationId,
  onSendMessage,
  onUploadImage,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
}) => {
  // const [queryInput, setQueryInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // const [voicePanelActive, setVoicePanelActive] = useState(false);
  // const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceTranscriptFinal, setVoiceTranscriptFinal] = useState("");
  const [voiceTranscriptInterim, setVoiceTranscriptInterim] = useState("");
  // const [voiceStartTime, setVoiceStartTime] = useState<number | null>(null);
  // const [elapsedTime, setElapsedTime] = useState(0);
  // const voiceInputRef = useRef<VoiceInputHandle>(null);
  // const textBeforeVoiceRef = useRef("");

  // const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  // const textareaRef = useRef<HTMLTextAreaElement>(null);

  // const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // refefence for ChatComposer
  const composerRef = useRef<ChatComposerHandle>(null);

  // ---------- to be a component initial page buttons -------------
  // paste message button
  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      const trimmedText = clipText.trim(); //text without empty space
      //if no copy text or text is just empty space, then no send
      if (!clipText || !trimmedText) return;

      shouldSpeakNextAIReplyRef.current = false; // in case like user clicked voice input and also clicked paste button

      // direct send
      onSendMessage(trimmedText);

      // show at input field
      //composerRef.current?.appendQueryText(clipText);

      // const textarea = textareaRef.current;
      // if (!textarea) {
      //   setQueryInput(clipText);
      //   return;
      // }

      // const start = textarea.selectionStart;
      // const end = textarea.selectionEnd;
      // const nextText =
      //   queryInput.substring(0, start) + clipText + queryInput.substring(end);

      // onSendMessage(nextText);

      // setTimeout(() => {
      //   textarea.focus();
      //   textarea.setSelectionRange(
      //     start + clipText.length,
      //     start + clipText.length,
      //   );
      // }, 0);
    } catch (err) {
      console.error("No Copied Message:", err);
    }
  };

  // open file upload button
  const handleOpenExplorer = () => {
    composerRef.current?.openFilePicker();
  };

  let questionIndex = React.useRef(0);
  const handleNextQuestion = () => {
    const questions: string[] = [
      "What is a scam?",
      "What are the most common types of scams?",
      "How can I tell if a message or phone call is a scam?",
      "What should I do if I have been scammed?",
      "How can I protect myself from scams?",
    ];

    const question = questions[questionIndex.current];
    questionIndex.current = (questionIndex.current + 1) % questions.length;

    composerRef.current?.setQueryText(question);
  };

  // ---------------------------------------------------------------

  // use text to speech hook
  const { speak, stop } = useTextToSpeech();
  // const isVoiceInputRef = useRef(false);
  const shouldSpeakNextAIReplyRef = useRef(false);
  const prevMessagesCountRef = useRef(messages.length);

  // Listen for new messages: If the current turn involves a voice conversation, the AI ​​automatically reads the response aloud.
  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current) {
      const latestMsg = messages[messages.length - 1];

      // Must be a new AI message, and the current conversation was triggered by voice
      if (
        latestMsg &&
        latestMsg.sender === "ai" &&
        shouldSpeakNextAIReplyRef.current
      ) {
        shouldSpeakNextAIReplyRef.current = false; // Reset the flag to avoid reading the next AI message aloud by default

        // Determine the language of the message based on whether it contains Chinese characters
        const isChinese = /[\u4e00-\u9fa5]/.test(latestMsg.text);
        speak(latestMsg.text, isChinese ? "zh-CN" : "en-US");
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages, speak]);

  // When the user switches conversations or exits, immediately stop the current speech
  useEffect(() => {
    stop();
    shouldSpeakNextAIReplyRef.current = false;
  }, [activeConversationId, stop]);

  // useEffect(() => {
  //   chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // }, [messages, isLoading]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    const close = () => setMenuOpenId(null);
    if (menuOpenId) {
      window.addEventListener("click", close);
      return () => window.removeEventListener("click", close);
    }
  }, [menuOpenId]);

  // // Auto-growing textarea
  // useEffect(() => {
  //   const textarea = textareaRef.current;
  //   if (textarea) {
  //     textarea.style.height = "auto";
  //     textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  //   }
  // }, [queryInput]);

  // // Voice timer
  // useEffect(() => {
  //   if (voicePanelActive && voiceStartTime) {
  //     voiceTimerRef.current = setInterval(() => {
  //       setElapsedTime(Math.floor((Date.now() - voiceStartTime) / 1000));
  //     }, 1000);
  //   } else {
  //     if (voiceTimerRef.current) {
  //       clearInterval(voiceTimerRef.current);
  //       voiceTimerRef.current = null;
  //     }
  //   }
  //   return () => {
  //     if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
  //   };
  // }, [voicePanelActive, voiceStartTime]);

  // const formatTime = (seconds: number) => {
  //   const mins = Math.floor(seconds / 60);
  //   const secs = seconds % 60;
  //   return `${mins}:${secs.toString().padStart(2, "0")}`;
  // };

  // const handleVoicePanelStateChange = (isActive: boolean) => {
  //   setVoicePanelActive(isActive);
  //   if (isActive) {
  //     textBeforeVoiceRef.current = queryInput;
  //     setVoiceStartTime(Date.now());
  //     setElapsedTime(0);
  //     setVoiceError(null);
  //   } else {
  //     setVoiceStartTime(null);
  //   }
  // };

  // const handleVoiceInterim = (text: string) => {
  //   if (!text.trim()) return;
  //   const prefix = textBeforeVoiceRef.current
  //     ? `${textBeforeVoiceRef.current} `
  //     : "";
  //   setQueryInput(prefix + text);
  // };

  // const handleVoiceResult = async (text: string) => {
  //   isVoiceInputRef.current = true;
  //   const prefix = textBeforeVoiceRef.current
  //     ? `${textBeforeVoiceRef.current} `
  //     : "";
  //   const fullText = prefix + text;
  //   setQueryInput(fullText);

  //   try {
  //     const response = await fetch(`${API_ORIGIN}/api/correct-speech`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ rawText: text }),
  //     });

  //     if (!response.ok) return;

  //     const data = await response.json();
  //     if (data.correctedText) {
  //       setQueryInput(prefix + data.correctedText);
  //     }
  //   } catch (error) {
  //     console.warn("Speech correction failed, keeping raw transcript:", error);
  //   }
  // };

  // const handleCancelVoice = () => {
  //   voiceInputRef.current?.cancel();
  //   setVoicePanelActive(false);
  //   setVoiceError(null);
  //   setQueryInput(textBeforeVoiceRef.current);
  //   textBeforeVoiceRef.current = "";
  // };

  // const handleFinishVoice = () => {
  //   voiceInputRef.current?.stop();
  //   setVoicePanelActive(false);
  //   setVoiceError(null);
  //   textBeforeVoiceRef.current = "";
  // };

  // const handleSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!queryInput.trim() || isLoading) return;

  //   if (isVoiceInputRef.current) {
  //     shouldSpeakNextAIReplyRef.current = true;
  //     isVoiceInputRef.current = false;
  //   } else {
  //     shouldSpeakNextAIReplyRef.current = false;
  //   }

  //   onSendMessage(queryInput);
  //   setQueryInput("");
  // };

  // const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file || isLoading) return;
  //   onUploadImage(file);
  //   if (fileInputRef.current) fileInputRef.current.value = "";
  // };

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  );
  const activeTitle = activeConversation?.title || "New check";
  const hasMessages = messages.length > 0;

  const selectConversation = (id: string) => {
    if (id === activeConversationId || isLoading) return;
    onSelectConversation(id);
    setSidebarOpen(false);
    setMenuOpenId(null);
  };

  const beginRename = (conversation: ManualConversationSummary) => {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title || "New check");
    setMenuOpenId(null);
  };

  const commitRename = () => {
    if (!renamingId) return;
    const next = renameValue.trim();
    if (next) {
      onRenameConversation(renamingId, next);
    }
    setRenamingId(null);
  };

  const requestDelete = (conversation: ManualConversationSummary) => {
    setMenuOpenId(null);
    if ((conversation.message_count || 0) > 0) {
      setConfirmDeleteId(conversation.id);
    } else {
      onDeleteConversation(conversation.id);
    }
  };

  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    onDeleteConversation(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="manual-workspace">
      {/* [HIDDEN_FOR_PUBLIC_VERSION] Sidebar commented out for public demo */}
      {/* <aside
        className={`manual-sidebar ${sidebarOpen ? "is-open" : ""}`}
        aria-label="Conversation history"
      >
        <div className="manual-sidebar-head">
          <button
            type="button"
            className="manual-new-chat-btn"
            onClick={() => {
              onNewConversation();
              setSidebarOpen(false);
            }}
            disabled={isLoading}
          >
            <PlusIcon />
            New check
          </button>
        </div>

        <nav
          className="manual-conversation-list"
          aria-label="Past conversations"
        >
          {conversations.length === 0 ? (
            <p className="manual-conversation-empty">
              Your checks will appear here.
            </p>
          ) : (
            conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              const isRenaming = renamingId === conversation.id;

              return (
                <div
                  key={conversation.id}
                  className={`manual-conversation-row ${isActive ? "is-active" : ""}`}
                >
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      className="manual-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename();
                        }
                        if (e.key === "Escape") {
                          setRenamingId(null);
                        }
                      }}
                      aria-label="Rename conversation"
                    />
                  ) : (
                    <button
                      type="button"
                      className="manual-conversation-item"
                      onClick={() => selectConversation(conversation.id)}
                      disabled={isLoading}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="manual-conversation-title">
                        {conversation.title || "New check"}
                      </span>
                    </button>
                  )}

                  <div className="manual-conversation-actions">
                    <button
                      type="button"
                      className="manual-icon-btn"
                      aria-label="Conversation options"
                      aria-expanded={menuOpenId === conversation.id}
                      disabled={isLoading || isRenaming}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId((prev) =>
                          prev === conversation.id ? null : conversation.id,
                        );
                      }}
                    >
                      <MoreIcon />
                    </button>
                    {menuOpenId === conversation.id && (
                      <div
                        className="manual-overflow-menu"
                        role="menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => beginRename(conversation)}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="danger"
                          onClick={() => requestDelete(conversation)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </nav>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="manual-sidebar-backdrop"
          aria-label="Close conversation list"
          onClick={() => setSidebarOpen(false)}
        />
      )} */}

      <section className="manual-main" aria-label="Scam check workspace">
        <header className="manual-main-header">
          {/* [HIDDEN_FOR_PUBLIC_VERSION] Sidebar toggle button commented out */}
          {/* <button
            type="button"
            className="manual-sidebar-toggle"
            aria-label="Open conversation list"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon />
          </button> */}

          {/* [HIDDEN_FOR_PUBLIC_VERSION] Stand-alone + button moved to global Header component */}
          {/* <button
            type="button"
            className="manual-new-chat-mini"
            onClick={() => { onNewConversation(); }}
            disabled={isLoading}
            aria-label="Start new conversation"
            title="New conversation"
          >
            <PlusIcon />
          </button> */}

          {/* [HIDDEN_FOR_PUBLIC_VERSION] Title+subtitle hidden when empty — hero already conveys the same */}
          {hasMessages && (
            <div className="manual-title-row">
              {renamingId === activeConversationId ? (
                <input
                  ref={renameInputRef}
                  className="manual-title-rename"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    }
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  aria-label="Rename conversation"
                />
              ) : (
                <h1>{activeTitle}</h1>
              )}

              {activeConversationId && (
                <div className="manual-title-actions">
                  <button
                    type="button"
                    className="manual-icon-btn"
                    aria-label="Conversation options"
                    disabled={isLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId((prev) =>
                        prev === `title-${activeConversationId}`
                          ? null
                          : `title-${activeConversationId}`,
                      );
                    }}
                  >
                    <MoreIcon />
                  </button>
                  {menuOpenId === `title-${activeConversationId}` &&
                    activeConversation && (
                      <div
                        className="manual-overflow-menu align-right"
                        role="menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => beginRename(activeConversation)}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="danger"
                          onClick={() => requestDelete(activeConversation)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </header>

        <ChatMessageList
          messages={messages}
          isLoading={isLoading}
          onPasteMessage={handlePaste}
          onUploadImage={handleOpenExplorer}
          onGeneralQuestion={handleNextQuestion}
        />

        <ChatComposer
          ref={composerRef}
          isLoading={isLoading}
          onSendMessage={(text, isVoice) => {
            shouldSpeakNextAIReplyRef.current = isVoice;
            onSendMessage(text);
          }}
          onUploadImage={onUploadImage}
        />
      </section>

      {confirmDeleteId && (
        <ConfirmModal
          isOpen={Boolean(confirmDeleteId)}
          title="Delete this check?"
          description="This removes the conversation and any uploaded images. This cannot be undone."
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
};

export default ManualView;
