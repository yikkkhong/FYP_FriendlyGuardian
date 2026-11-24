// what happened at the conversation panel, the whole conversation page
// such as scrolling, what happened after user pressed the 3 default button, when should show the empty/initial state

import React, { useState, useRef, useEffect } from "react";
import ChatEmptyState from "./ChatEmptyState";
import { ManualMessage } from "../../views/ManualView";
import ChatMessageItem, { AttachmentPreview } from "./ChatMessageItem";

interface ChatMessageListProps {
  messages: ManualMessage[];
  isLoading: boolean;
  onPasteMessage: () => void;
  onUploadImage: () => void;
  onGeneralQuestion: () => void;
  onPreviewAttachment: (preview: AttachmentPreview, trigger: HTMLButtonElement) => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isLoading,
  onPasteMessage,
  onUploadImage,
  onGeneralQuestion,
  onPreviewAttachment,
}) => {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const streamViewportRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      setIsScrolling(true);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1000);
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
    <div
      ref={streamViewportRef}
      className={`manual-stream-viewport ${isScrolling ? "is-scrolling" : ""}`}
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
          onPreviewAttachment={onPreviewAttachment}
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
    </div>

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
    </>
  );
};

export default ChatMessageList;
