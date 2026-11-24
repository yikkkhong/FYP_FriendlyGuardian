// the conversation bubble (user and AI)

// src/components/chat/ChatMessageItem.tsx
import React from "react";
import ThreatReportCard, { parseReport } from "../message/ThreatReportCard";
import { AiResponseCard } from "../message/AiResponseCard";
import { ManualMessage } from "../../views/ManualView";
import { FileIcon } from "../icons/Icons";

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

export interface AttachmentPreview {
  src: string;
  name: string;
  isPdf: boolean;
}

interface ChatMessageItemProps {
  message: ManualMessage;
  isLatest: boolean;
  onPreviewAttachment: (preview: AttachmentPreview, trigger: HTMLButtonElement) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isLatest,
  onPreviewAttachment,
}) => {
  const isUser = message.sender === "user";
  const report = !isUser ? parseReport(message.text) : null;
  const isAnalysisMessage =
    message.messageType === "analysis" ||
    (message.messageType == null && !!report);
  const showRiskCard = !isUser && isAnalysisMessage && !!report;
  const imageSrc = resolveImageUrl(message.imageUrl);
  const audioExtension = /\.(mp3|wav|m4a|ogg|webm)$/i;
  const isAudio = audioExtension.test(message.imageName || "") ||
    audioExtension.test(imageSrc?.split(/[?#]/)[0] || "");

  const isPdf =
    message.imageName?.toLowerCase().endsWith(".pdf") ||
    imageSrc?.split(/[?#]/)[0].toLowerCase().endsWith(".pdf");

  const isDefaultUploadText =
    message.text?.startsWith("[Uploaded Screenshot:") ||
    message.text?.startsWith("[Uploaded image]");
  const shouldShowText = message.text && !isDefaultUploadText;

  return (
    <div className={`manual-msg-row ${isUser ? "user" : "ai"}`}>
      <div className="manual-msg-meta">
        <span className="meta-label">{isUser ? "You" : "Guardian"}</span>
        <span className="meta-time">{message.time}</span>
      </div>

      {isUser ? (
        <div className="user-bubble-group">
          {imageSrc && isAudio && (
            <div className="user-media-bubble">
              <audio controls src={imageSrc} style={{ maxWidth: "280px" }} />
            </div>
          )}
          {imageSrc && !isAudio && (
            <div
              className={`user-media-bubble ${isPdf ? "is-pdf" : "is-image"}`}
            >
              {/* Open attachments in the workspace while audio keeps its own controls. */}
              <button
                type="button"
                className="manual-image-preview-link"
                aria-label={`Preview ${message.imageName || (isPdf ? "PDF" : "image")}`}
                onClick={(event) => onPreviewAttachment({
                  src: imageSrc,
                  name: message.imageName || (isPdf ? "Document.pdf" : "Uploaded image"),
                  isPdf: Boolean(isPdf),
                }, event.currentTarget)}
                style={
                  isPdf
                    ? {
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 14px 8px 10px",
                        backgroundColor: "#FEF3C7",
                        borderRadius: "10px",
                        textDecoration: "none",
                        color: "inherit",
                        border: "1px solid #FDE68A",
                      }
                    : undefined
                }
              >
                {isPdf ? (
                  <>
                    <FileIcon />
                    <span
                      style={{
                        fontSize: "14.5px",
                        fontWeight: 600,
                        color: "#1E293B",
                        wordBreak: "break-all",
                      }}
                    >
                      {message.imageName || "Document.pdf"}
                    </span>
                  </>
                ) : (
                  <img
                    src={imageSrc}
                    alt={message.imageName || "Uploaded screenshot"}
                    className="manual-image-preview"
                  />
                )}
              </button>
            </div>
          )}
          {/* {message.text &&
            !message.text.startsWith("[Uploaded Screenshot:") &&
            message.text}
          {message.text?.startsWith("[Uploaded Screenshot:") &&
            !imageSrc &&
            message.text}
          {imageSrc && message.imageName && (
            <span className="manual-image-caption">{message.imageName}</span>
          )}
          </div> */}
          {/* show text message also with image/file uploaded */}
          {shouldShowText && (
            <div className="user-query-bubble">{message.text}</div>
          )}
        </div>
      ) : showRiskCard && report ? (
        <ThreatReportCard report={report!} speechOwner={message} isNew={!isUser && isLatest} />
      ) : (
        // <div className="plain-ai-bubble">{m.text}</div>
        <AiResponseCard content={message.text} />
      )}
    </div>
  );
};

export default ChatMessageItem;
