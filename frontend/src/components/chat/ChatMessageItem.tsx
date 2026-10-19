// the conversation bubble (user and AI)

// src/components/chat/ChatMessageItem.tsx
import React from "react";
import ThreatReportCard, { parseReport } from "../scam/ThreatReportCard";
import { AiResponseCard } from "../scam/AiResponseCard";
import { ManualMessage } from "../../views/ManualView";

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

interface ChatMessageItemProps {
  message: ManualMessage;
  isLatest: boolean;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isLatest,
}) => {
  const isUser = message.sender === "user";
  const report = !isUser ? parseReport(message.text) : null;
  const isAnalysisMessage =
    message.messageType === "analysis" ||
    (message.messageType == null && !!report);
  const showRiskCard = !isUser && isAnalysisMessage && !!report;
  const imageSrc = resolveImageUrl(message.imageUrl);

  return (
    <div className={`manual-msg-row ${isUser ? "user" : "ai"}`}>
      <div className="manual-msg-meta">
        <span className="meta-label">{isUser ? "You" : "Guardian"}</span>
        <span className="meta-time">{message.time}</span>
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
                alt={message.imageName || "Uploaded screenshot"}
                className="manual-image-preview"
              />
            </a>
          )}
          {message.text &&
            !message.text.startsWith("[Uploaded Screenshot:") &&
            message.text}
          {message.text?.startsWith("[Uploaded Screenshot:") &&
            !imageSrc &&
            message.text}
          {imageSrc && message.imageName && (
            <span className="manual-image-caption">{message.imageName}</span>
          )}
        </div>
      ) : showRiskCard && report ? (
        <ThreatReportCard report={report!} isNew={!isUser && isLatest} />
      ) : (
        // <div className="plain-ai-bubble">{m.text}</div>
        <AiResponseCard content={message.text} />
      )}
    </div>
  );
};

export default ChatMessageItem;
