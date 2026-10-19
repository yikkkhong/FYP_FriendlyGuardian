// what happened at the conversation panel, the whole conversation page
// such as scrolling, what happened after user pressed the 3 default button, when should show the empty/initial state

import React, { useState, useRef, useEffect } from "react";
import ThreatReportCard, { parseReport } from "../scam/ThreatReportCard";
import { AiResponseCard } from "../scam/AiResponseCard";
import ChatEmptyState from "./ChatEmptyState";
import { ManualMessage } from "../../views/ManualView";
import ChatMessageItem from "./ChatMessageItem";

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

interface ChatMessageListProps {
  messages: ManualMessage[];
  isLoading: boolean;
  onPasteMessage: () => void;
  onUploadImage: () => void;
  onGeneralQuestion: () => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isLoading,
  onPasteMessage,
  onUploadImage,
  onGeneralQuestion,
}) => {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const streamViewportRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // scroll to bottom when got new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // check scroll to bottom button display or not
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

  return (
    <div
      ref={streamViewportRef}
      className="manual-stream-viewport"
      role="log"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Chat messages"
    >
      {messages.length === 0 && !isLoading && (
        <ChatEmptyState
          isLoading={isLoading}
          onPasteMessage={onPasteMessage}
          onUploadImage={onUploadImage}
          onGeneralQuestion={onGeneralQuestion}
        />
      )}

      {/* {messages.map((m, idx) => {
        const isUser = m.sender === "user";
        const report = !isUser ? parseReport(m.text) : null;
        // Structured type from backend; legacy messages without type still
        // show a risk card when the RISK LEVEL template is present.
        const isAnalysisMessage =
          m.messageType === "analysis" || (m.messageType == null && !!report);
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
              <span className="meta-label">{isUser ? "You" : "Guardian"}</span>
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
                  <span className="manual-image-caption">{m.imageName}</span>
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
      })} */}

      {messages.map((m, idx) => (
        <ChatMessageItem
          key={`${m.time}-${idx}-${m.imageUrl || m.text.slice(0, 12)}`}
          message={m}
          isLatest={idx === messages.length - 1}
        />
      ))}

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
  );
};

export default ChatMessageList;
