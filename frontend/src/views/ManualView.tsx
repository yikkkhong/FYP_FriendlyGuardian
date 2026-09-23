import React, { useState, useRef, useEffect } from "react";

export interface ManualMessage {
  sender: "user" | "ai";
  text: string;
  time: string;
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
}

type RiskKey = "HIGH" | "MEDIUM" | "LOW" | "SAFE";

const RISK_COPY: Record<
  RiskKey,
  { label: string; headline: string; guidance: string }
> = {
  HIGH: {
    label: "Dangerous",
    headline: "This looks like a scam — do not proceed.",
    guidance: "Stop and protect your accounts before doing anything else.",
  },
  MEDIUM: {
    label: "Suspicious",
    headline: "This needs extra caution.",
    guidance: "Verify through an official channel before you reply or pay.",
  },
  LOW: {
    label: "Low risk",
    headline: "Likely low risk, but stay careful.",
    guidance: "Double-check details if anything still feels off.",
  },
  SAFE: {
    label: "Looks safe",
    headline: "No strong scam signals found.",
    guidance: "You can proceed, but keep normal security habits.",
  },
};

function RiskIcon({ risk }: { risk: RiskKey }) {
  if (risk === "HIGH") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="manual-risk-icon">
        <path
          fill="currentColor"
          d="M12 2L1 21h22L12 2zm0 4.5L19.5 19h-15L12 6.5zM11 10v5h2v-5h-2zm0 6v2h2v-2h-2z"
        />
      </svg>
    );
  }
  if (risk === "MEDIUM") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="manual-risk-icon">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="manual-risk-icon">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.4l-3.7-3.7 1.4-1.4 2.3 2.3 5-5 1.4 1.4-6.4 6.4z"
      />
    </svg>
  );
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
      <path
        fill="currentColor"
        d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"
      />
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
}) => {
  const [queryInput, setQueryInput] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim() || isLoading) return;
    onSendMessage(queryInput);
    setQueryInput("");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLoading) return;
    onUploadImage(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const parseReport = (rawText: string) => {
    const riskMatch = rawText.match(/RISK LEVEL:\s*([A-Z]+)/i);
    if (!riskMatch) return null;

    const risk = riskMatch[1].toUpperCase() as RiskKey;
    const whyMatch = rawText.match(/WHY:\s*([\s\S]*?)(?=RECOMMENDATION:|$)/i);
    const recMatch = rawText.match(/RECOMMENDATION:\s*([\s\S]*?)$/i);

    const parseBullets = (str: string | undefined) =>
      str
        ? str
            .split("\n")
            .map((l) => l.replace(/^[-*•]\s*/, "").trim())
            .filter(Boolean)
        : [];

    return {
      risk,
      why: parseBullets(whyMatch?.[1]),
      recommendations: parseBullets(recMatch?.[1]),
    };
  };

  const activeTitle =
    conversations.find((c) => c.id === activeConversationId)?.title ||
    "New check";

  const selectConversation = (id: string) => {
    if (id === activeConversationId || isLoading) return;
    onSelectConversation(id);
    setSidebarOpen(false);
  };

  return (
    <div className="manual-workspace">
      <aside
        className={`manual-sidebar ${sidebarOpen ? "is-open" : ""}`}
        aria-label="Conversation history"
      >
        <div className="manual-sidebar-head">
          <p className="manual-sidebar-label">Checks</p>
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
            New conversation
          </button>
        </div>

        <nav className="manual-conversation-list" aria-label="Past conversations">
          {conversations.length === 0 ? (
            <p className="manual-conversation-empty">
              Your checks will appear here.
            </p>
          ) : (
            conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`manual-conversation-item ${isActive ? "is-active" : ""}`}
                  onClick={() => selectConversation(conversation.id)}
                  disabled={isLoading}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="manual-conversation-title">
                    {conversation.title || "New check"}
                  </span>
                  {conversation.preview ? (
                    <span className="manual-conversation-preview">
                      {conversation.preview}
                    </span>
                  ) : (
                    <span className="manual-conversation-preview">
                      Empty conversation
                    </span>
                  )}
                </button>
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
          <div className="manual-main-heading">
            <p className="manual-eyebrow">Manual Mode · SME</p>
            <h1>{activeTitle}</h1>
            <p className="manual-subcopy">
              Paste a message, link, or account number. Your guardian will tell
              you if it is safe, suspicious, or dangerous — and what to do next.
            </p>
          </div>
        </header>

        <div className="manual-stream-card">
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
                  Paste a suspicious SMS, email, bank account, or upload a
                  screenshot. Each conversation stays separate so past checks
                  are easy to revisit.
                </p>
              </div>
            )}

            {messages.map((m, idx) => {
              const isUser = m.sender === "user";
              const report = !isUser ? parseReport(m.text) : null;
              const riskMeta =
                report && RISK_COPY[report.risk]
                  ? RISK_COPY[report.risk]
                  : null;

              return (
                <div
                  key={`${m.time}-${idx}`}
                  className={`manual-msg-row ${isUser ? "user" : "ai"}`}
                >
                  <div className="manual-msg-meta">
                    <span className="meta-label">
                      {isUser ? "You" : "Guardian"}
                    </span>
                    <span className="meta-time">{m.time}</span>
                  </div>

                  {isUser ? (
                    <div className="user-query-bubble">{m.text}</div>
                  ) : report && riskMeta ? (
                    <article
                      className={`threat-report-card risk-${report.risk.toLowerCase()}`}
                      aria-label={`Risk result: ${riskMeta.label}`}
                    >
                      <div className="report-verdict">
                        <div
                          className={`risk-level-badge ${report.risk.toLowerCase()}`}
                        >
                          <RiskIcon risk={report.risk} />
                          <span>{riskMeta.label}</span>
                        </div>
                        <div className="report-verdict-copy">
                          <h3>{riskMeta.headline}</h3>
                          <p>{riskMeta.guidance}</p>
                        </div>
                      </div>

                      {report.why.length > 0 && (
                        <div className="report-section">
                          <span className="section-label">Why</span>
                          <ul className="report-list alert-list">
                            {report.why.map((point, i) => (
                              <li key={i}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {report.recommendations.length > 0 && (
                        <div className="report-section report-section-action">
                          <span className="section-label">What to do next</span>
                          <ul className="report-list action-list">
                            {report.recommendations.map((point, i) => (
                              <li key={i}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </article>
                  ) : (
                    <div className="plain-ai-bubble">{m.text}</div>
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
                <span className="manual-loading-text">
                  Checking this message…
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
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

          <label htmlFor="manual-query-input" className="sr-only">
            Message or account to check
          </label>
          <input
            id="manual-query-input"
            type="text"
            placeholder="Paste a suspicious message, link, or account number…"
            className="query-input"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
          />
          <button
            type="submit"
            className="query-submit-action"
            disabled={isLoading || !queryInput.trim()}
          >
            {isLoading ? "Checking…" : "Check"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default ManualView;
