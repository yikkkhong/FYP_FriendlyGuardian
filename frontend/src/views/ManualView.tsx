import React, { useState, useRef, useEffect } from "react";
import ThreatReportCard, { parseReport } from "../components/ThreatReportCard";
import VoiceInputButton, {
  VoiceInputHandle,
} from "../components/VoiceInputButton";
import useTextToSpeech from "../hooks/useTextToSpeech";
import FormattedMessage, { AiResponseCard } from "../components/AiResponseCard";

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

const API_ORIGIN = "http://localhost:5000";

function resolveImageUrl(url?: string) {
  if (!url) return undefined;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M14 10v11M12 2L2 7h20L12 2z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function TrendingIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
      <path
        fill="currentColor"
        d="M4 7h16v2H4V7zm0 4h16v2H4v-2zm0 4h16v2H4v-2z"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        fill="currentColor"
        d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"
      />
    </svg>
  );
}

function GuardianMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="manual-empty-mark">
      <circle cx="24" cy="24" r="22" fill="#CCFBF1" />
      <circle cx="24" cy="24" r="14" fill="#0F766E" />
      <circle cx="18" cy="22" r="2.5" fill="#fff" />
      <circle cx="30" cy="22" r="2.5" fill="#fff" />
      <path
        d="M18 29c2.2 2.4 9.8 2.4 12 0"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  const [queryInput, setQueryInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [voicePanelActive, setVoicePanelActive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceTranscriptFinal, setVoiceTranscriptFinal] = useState("");
  const [voiceTranscriptInterim, setVoiceTranscriptInterim] = useState("");
  const [voiceStartTime, setVoiceStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const voiceInputRef = useRef<VoiceInputHandle>(null);
  const textBeforeVoiceRef = useRef("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamViewportRef = useRef<HTMLDivElement>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------- to be a component initial page buttons -------------
  // paste message button
  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText) return;

      const textarea = textareaRef.current;
      if (!textarea) {
        setQueryInput(clipText);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextText =
        queryInput.substring(0, start) + clipText + queryInput.substring(end);

      onSendMessage(nextText);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + clipText.length,
          start + clipText.length,
        );
      }, 0);
    } catch (err) {
      console.error("No Copied Message:", err);
    }
  };

  // open file upload button
  const handleOpenExplorer = () => {
    fileInputRef.current?.click();
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

    setQueryInput(question);
  };

  // ---------------------------------------------------------------

  // use text to speech hook
  const { speak, stop } = useTextToSpeech();
  const isVoiceInputRef = useRef(false);
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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

  // Auto-growing textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [queryInput]);

  // Voice timer
  useEffect(() => {
    if (voicePanelActive && voiceStartTime) {
      voiceTimerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - voiceStartTime) / 1000));
      }, 1000);
    } else {
      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
    }
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    };
  }, [voicePanelActive, voiceStartTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Scroll to bottom detection
  useEffect(() => {
    const viewport = streamViewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollToBottom(!isNearBottom);
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleVoicePanelStateChange = (isActive: boolean) => {
    setVoicePanelActive(isActive);
    if (isActive) {
      textBeforeVoiceRef.current = queryInput;
      setVoiceStartTime(Date.now());
      setElapsedTime(0);
      setVoiceError(null);
    } else {
      setVoiceStartTime(null);
    }
  };

  const handleVoiceInterim = (text: string) => {
    if (!text.trim()) return;
    const prefix = textBeforeVoiceRef.current
      ? `${textBeforeVoiceRef.current} `
      : "";
    setQueryInput(prefix + text);
  };

  const handleVoiceResult = async (text: string) => {
    isVoiceInputRef.current = true;
    const prefix = textBeforeVoiceRef.current
      ? `${textBeforeVoiceRef.current} `
      : "";
    const fullText = prefix + text;
    setQueryInput(fullText);

    try {
      const response = await fetch(`${API_ORIGIN}/api/correct-speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: text }),
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.correctedText) {
        setQueryInput(prefix + data.correctedText);
      }
    } catch (error) {
      console.warn("Speech correction failed, keeping raw transcript:", error);
    }
  };

  const handleCancelVoice = () => {
    voiceInputRef.current?.cancel();
    setVoicePanelActive(false);
    setVoiceError(null);
    setQueryInput(textBeforeVoiceRef.current);
    textBeforeVoiceRef.current = "";
  };

  const handleFinishVoice = () => {
    voiceInputRef.current?.stop();
    setVoicePanelActive(false);
    setVoiceError(null);
    textBeforeVoiceRef.current = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim() || isLoading) return;

    if (isVoiceInputRef.current) {
      shouldSpeakNextAIReplyRef.current = true;
      isVoiceInputRef.current = false;
    } else {
      shouldSpeakNextAIReplyRef.current = false;
    }

    onSendMessage(queryInput);
    setQueryInput("");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLoading) return;
    onUploadImage(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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

        <div
          ref={streamViewportRef}
          className="manual-stream-viewport"
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label="Chat messages"
        >
          {messages.length === 0 && !isLoading && (
            <div className="manual-empty-state">
              <div className="guardian-orb" aria-hidden="true">
                <GuardianMark />
              </div>
              <h2>Is this a scam?</h2>
              <p>
                Paste a suspicious SMS, email, link, or bank account — your
                Guardian checks it instantly.
              </p>
              <div className="manual-suggestion-chips">
                {/* <button
                  type="button"
                  className="manual-suggestion-chip"
                  onClick={() =>
                    setQueryInput("Is this bank account number safe?")
                  }
                  disabled={isLoading}
                >
                  <BankIcon /> Check bank account
                </button> */}
                <button
                  type="button"
                  className="manual-suggestion-chip"
                  onClick={() => handlePaste()}
                  disabled={isLoading}
                >
                  <PhoneIcon /> Paste Message
                </button>
                <button
                  type="button"
                  className="manual-suggestion-chip"
                  onClick={() => handleOpenExplorer()}
                  disabled={isLoading}
                >
                  <CameraIcon /> Upload Image
                </button>
                <button
                  type="button"
                  className="manual-suggestion-chip"
                  onClick={() => handleNextQuestion()}
                  disabled={isLoading}
                >
                  <MenuIcon /> General Question
                </button>
              </div>
              <p className="hero-no-signup">No sign-up needed · Free to use</p>
            </div>
          )}

          {messages.map((m, idx) => {
            const isUser = m.sender === "user";
            const report = !isUser ? parseReport(m.text) : null;
            // Structured type from backend; legacy messages without type still
            // show a risk card when the RISK LEVEL template is present.
            const isAnalysisMessage =
              m.messageType === "analysis" ||
              (m.messageType == null && !!report);
            const showRiskCard = !isUser && isAnalysisMessage && !!report;
            // const showRiskCard =
            //   !isUser &&
            //   isAnalysisMessage &&
            //   report &&
            // RISK_COPY[report.risk];
            // const riskMeta = showRiskCard ? RISK_COPY[report!.risk] : null;
            const imageSrc = resolveImageUrl(m.imageUrl);

            return (
              <div
                key={`${m.time}-${idx}-${m.imageUrl || m.text.slice(0, 12)}`}
                className={`manual-msg-row ${isUser ? "user" : "ai"}`}
              >
                <div className="manual-msg-meta">
                  <span className="meta-label">
                    {isUser ? "You" : "Guardian"}
                  </span>
                  <span className="meta-time">{m.time}</span>
                </div>

                {isUser ? (
                  <div className="user-query-bubble">
                    {imageSrc && (
                      <a
                        href={imageSrc}
                        target="_blank"
                        rel="noreferrer"
                        className="manual-image-preview-link"
                      >
                        <img
                          src={imageSrc}
                          alt={m.imageName || "Uploaded screenshot"}
                          className="manual-image-preview"
                        />
                      </a>
                    )}
                    {m.text &&
                      !m.text.startsWith("[Uploaded Screenshot:") &&
                      m.text}
                    {m.text?.startsWith("[Uploaded Screenshot:") &&
                      !imageSrc &&
                      m.text}
                    {imageSrc && m.imageName && (
                      <span className="manual-image-caption">
                        {m.imageName}
                      </span>
                    )}
                  </div>
                ) : showRiskCard && report ? (
                  <ThreatReportCard
                    report={report!}
                    isNew={!isUser && idx === messages.length - 1}
                  />
                ) : (
                  // <div className="plain-ai-bubble">{m.text}</div>
                  <AiResponseCard content={m.text} />
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="manual-loading-row" role="status">
              <span className="manual-loading-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="manual-loading-text">Checking…</span>
            </div>
          )}
          <div ref={chatEndRef} />

          {showScrollToBottom && (
            <button
              type="button"
              className="scroll-to-bottom-btn"
              onClick={scrollToBottom}
              aria-label="Scroll to bottom"
            >
              ↓
            </button>
          )}
        </div>

        <div className="manual-composer-wrapper">
          {/* Floating error pill above composer — non-intrusive, auto-dismissible */}
          {voiceError && (
            <div className="voice-error-banner" role="alert" aria-live="polite">
              <span className="voice-error-text">{voiceError}</span>
              <button
                type="button"
                className="voice-error-retry"
                onClick={() => {
                  setVoiceError(null);
                  voiceInputRef.current?.start();
                }}
              >
                Try again
              </button>
              <button
                type="button"
                className="voice-error-close"
                onClick={() => setVoiceError(null)}
                aria-label="Dismiss error"
              >
                x
              </button>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className={`manual-composer ${voicePanelActive ? "is-voice-listening" : ""}`}
          >
            {/* [HIDDEN_FOR_PUBLIC_VERSION] Voice scrim overlay commented out for flat, unblurred experience */}
            {/* {voicePanelActive && (
              <div className="voice-scrim" onClick={(e) => e.preventDefault()} />
            )} */}

            <input
              type="file"
              ref={fileInputRef}
              className="manual-file-input"
              accept="image/*"
              onChange={handleImageUpload}
            />

            {/* Camera slot transforms into ghost Cancel (X) button when voice listening */}
            {voicePanelActive ? (
              <button
                type="button"
                className="query-cancel-btn"
                onClick={handleCancelVoice}
                aria-label="Cancel voice input"
                title="Cancel voice input"
              >
                <CloseIcon />
              </button>
            ) : (
              <button
                type="button"
                className="query-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                aria-label="Upload suspicious screenshot"
                title="Upload suspicious screenshot"
              >
                <CameraIcon />
              </button>
            )}

            <VoiceInputButton
              ref={voiceInputRef}
              onResult={handleVoiceResult}
              onInterim={handleVoiceInterim}
              lang="en-US"
              onPanelStateChange={handleVoicePanelStateChange}
              onError={setVoiceError}
            />

            {/* Balanced fancy soundwave equalizer animation while user is talking */}
            {voicePanelActive && (
              <div
                className="composer-voice-eq"
                aria-hidden="true"
                title="Listening to voice"
              >
                <span className="composer-voice-bar" />
                <span className="composer-voice-bar" />
                <span className="composer-voice-bar" />
                <span className="composer-voice-bar" />
              </div>
            )}

            {/* [HIDDEN_FOR_PUBLIC_VERSION] Large voice panel card modal commented out in favor of in-place pill transformation */}
            {/* {voicePanelActive && (
              <div className="voice-panel-legacy">Legacy voice panel commented out</div>
            )} */}

            <label htmlFor="manual-query-input" className="sr-only">
              Message or account to check
            </label>
            <textarea
              ref={textareaRef}
              id="manual-query-input"
              placeholder={
                voicePanelActive
                  ? "Listening... speak now"
                  : "Paste a message, ask a follow-up, or describe what you received…"
              }
              className="query-input"
              value={queryInput}
              aria-live={voicePanelActive ? "polite" : "off"}
              onChange={(e) => {
                const val = e.target.value;
                setQueryInput(val);
                if (voiceError) setVoiceError(null);
                if (!val.trim()) {
                  isVoiceInputRef.current = false;
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (voicePanelActive) {
                    handleCancelVoice();
                  } else {
                    setQueryInput("");
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (voicePanelActive) {
                    handleFinishVoice();
                  } else if (queryInput.trim() && !isLoading) {
                    handleSubmit(e);
                  }
                }
              }}
              disabled={isLoading}
              autoComplete="off"
              rows={1}
              style={{
                resize: "none",
                height: "auto",
                minHeight: "44px",
                maxHeight: "150px",
                overflowY: "auto",
              }}
            />

            {/* Live timer when speaking */}
            {voicePanelActive && (
              <span className="composer-voice-timer" aria-live="off">
                {formatTime(elapsedTime)}
              </span>
            )}

            {/* Send button becomes Done button when voice listening */}
            {voicePanelActive ? (
              <button
                type="button"
                className="query-submit-action voice-done-btn"
                onClick={handleFinishVoice}
                aria-label="Finish speaking"
              >
                Done
              </button>
            ) : (
              <button
                type="submit"
                className="query-submit-action"
                disabled={isLoading || !queryInput.trim()}
              >
                {isLoading ? "…" : "Send"}
              </button>
            )}
          </form>
        </div>
      </section>

      {confirmDeleteId && (
        <div className="manual-confirm-backdrop" role="presentation">
          <div
            className="manual-confirm-dialog"
            role="alertdialog"
            aria-labelledby="manual-delete-title"
            aria-describedby="manual-delete-desc"
          >
            <h2 id="manual-delete-title">Delete this check?</h2>
            <p id="manual-delete-desc">
              This removes the conversation and any uploaded images. This cannot
              be undone.
            </p>
            <div className="manual-confirm-actions">
              <button
                type="button"
                className="manual-confirm-cancel"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="manual-confirm-delete"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualView;
