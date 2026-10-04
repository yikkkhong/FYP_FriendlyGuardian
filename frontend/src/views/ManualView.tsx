import React, { useState, useRef, useEffect } from "react";
import ThreatReportCard, { parseReport } from "../components/ThreatReportCard";
import VoiceInputButton from "../components/VoiceInputButton";
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
    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
      <path
        fill="currentColor"
        d="M9 3l1.2 2H15l1.2-2H20a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5zm3 5a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"
      />
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
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  const handleVoiceResult = (text: string) => {
    isVoiceInputRef.current = true;
    setQueryInput((prev) => (prev ? prev + " " : "") + text);
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
      <aside
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
      )}

      <section className="manual-main" aria-label="Scam check workspace">
        <header className="manual-main-header">
          <button
            type="button"
            className="manual-sidebar-toggle"
            aria-label="Open conversation list"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon />
          </button>

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

          {!hasMessages && (
            <p className="manual-subcopy">
              Paste a message, link, or account number — or upload a screenshot.
              Your guardian will tell you if it looks safe, suspicious, or
              dangerous.
            </p>
          )}
        </header>

        <div
          className="manual-stream-viewport"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.length === 0 && !isLoading && (
            <div className="manual-empty-state">
              <GuardianMark />
              <h2>Ready when you are</h2>
              <p>
                Paste a suspicious SMS, email, or bank account — or upload a
                screenshot. Each check stays in its own conversation.
              </p>
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
                  <ThreatReportCard report={report!} />
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
        </div>

        <form onSubmit={handleSubmit} className="manual-composer">
          <input
            type="file"
            ref={fileInputRef}
            className="manual-file-input"
            accept="image/*"
            onChange={handleImageUpload}
          />
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

          <VoiceInputButton onResult={handleVoiceResult} lang="en-US" />

          <label htmlFor="manual-query-input" className="sr-only">
            Message or account to check
          </label>
          <input
            id="manual-query-input"
            type="text"
            placeholder="Paste a message, ask a follow-up, or describe what you received…"
            className="query-input"
            value={queryInput}
            onChange={(e) => {
              setQueryInput(e.target.value);
              isVoiceInputRef.current = false;
            }}
            disabled={isLoading}
            autoComplete="off"
          />
          <button
            type="submit"
            className="query-submit-action"
            disabled={isLoading || !queryInput.trim()}
          >
            {isLoading ? "…" : "Send"}
          </button>
        </form>
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
