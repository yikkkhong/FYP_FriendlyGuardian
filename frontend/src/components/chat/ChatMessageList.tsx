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
