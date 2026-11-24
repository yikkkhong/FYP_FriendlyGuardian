import React, { useState, useRef, useEffect } from "react";
import { CloseIcon, MoreIcon } from "../components/icons/Icons";
import ConfirmModal from "../components/common/ConfirmModal";
import ChatMessageList from "../components/chat/ChatMessageList";
import type { AttachmentPreview } from "../components/chat/ChatMessageItem";
import ChatComposer, {
  ChatComposerHandle,
} from "../components/chat/ChatComposer";

import useAutoSpeakReply from "../hooks/useAutoSpeakReply";
import useConversationManage from "../hooks/useConversationManage";
import { handleEmptyStatePaste } from "../utils/pasteUtils";

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
  messages: ManualMessage[];
  isLoading: boolean;
  conversations: ManualConversationSummary[];
  activeConversationId: string | null;
  onSendMessage: (message: string) => void;
  onUploadImage: (file: File, queryText?: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onExportReport: () => void;
  onResetProfile: () => void;
}


function pdfPreviewUrl(src: string) {
  const url = new URL(src);
  const options = new URLSearchParams(url.hash.slice(1));
  options.set("navpanes", "0");
  options.set("view", "FitH");
  url.hash = options.toString();
  return url.href;
}

export const ManualView: React.FC<ManualViewProps> = ({
  messages,
  isLoading,
  conversations,
  activeConversationId,
  onSendMessage,
  onUploadImage,
  onRenameConversation,
  onDeleteConversation,
  onExportReport,
  onResetProfile,
}) => {
  // Keep the attachment mounted while the drawer closes.
  const [preview, setPreview] = useState<AttachmentPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [readyPdf, setReadyPdf] = useState<AttachmentPreview | null>(null);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const closePreviewButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setPreviewOpen(false);
    setPreview(null);
  }, [activeConversationId]);
  useEffect(() => {
    if (previewOpen) closePreviewButton.current?.focus();
  }, [previewOpen]);

  // Give the drawer's 250 ms slide time to finish before starting the PDF viewer.
  useEffect(() => {
    setReadyPdf(null);
    if (!previewOpen || !preview?.isPdf) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280;
    const timer = window.setTimeout(() => setReadyPdf(preview), delay);
    return () => window.clearTimeout(timer);
  }, [preview, previewOpen]);

  const closePreview = () => {
    setPreviewOpen(false);
    previewTrigger.current?.focus();
  };

  // Confirm the reset before changing shared-device preferences.
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetToast, setResetToast] = useState(false);
  useEffect(() => {
    if (!resetToast) return;
    const timer = window.setTimeout(() => setResetToast(false), 3500);
    return () => window.clearTimeout(timer);
  }, [resetToast]);
  // const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // const [renamingId, setRenamingId] = useState<string | null>(null);
  // const [renameValue, setRenameValue] = useState("");
  // const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // const renameInputRef = useRef<HTMLInputElement>(null);

  // refefence for ChatComposer
  const composerRef = useRef<ChatComposerHandle>(null);

  //useAutoSpeakReply
  const { markNextReplyToSpeak } = useAutoSpeakReply({
    messages,
    activeConversationId,
  });

  //useConversationManage
  const {
    menuOpenId,
    setMenuOpenId,
    renamingId,
    setRenamingId,
    renameValue,
    setRenameValue,
    renameInputRef,
    confirmDeleteId,
    setConfirmDeleteId,
    beginRename,
    commitRename,
    requestDelete,
    confirmDelete,
  } = useConversationManage({
    onRenameConversation,
    onDeleteConversation,
  });

  // ---------- empty/initial page buttons -------------
  // paste message button

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

  // // use text to speech hook
  // const { speak, stop } = useTextToSpeech();
  // // const isVoiceInputRef = useRef(false);
  // const shouldSpeakNextAIReplyRef = useRef(false);
  // const prevMessagesCountRef = useRef(messages.length);

  // // Listen for new messages: If the current turn involves a voice conversation, the AI ​​automatically reads the response aloud.
  // useEffect(() => {
  //   if (messages.length > prevMessagesCountRef.current) {
  //     const latestMsg = messages[messages.length - 1];

  //     // Must be a new AI message, and the current conversation was triggered by voice
  //     if (
  //       latestMsg &&
  //       latestMsg.sender === "ai" &&
  //       shouldSpeakNextAIReplyRef.current
  //     ) {
  //       shouldSpeakNextAIReplyRef.current = false; // Reset the flag to avoid reading the next AI message aloud by default

  //       // Determine the language of the message based on whether it contains Chinese characters
  //       const isChinese = /[\u4e00-\u9fa5]/.test(latestMsg.text);
  //       speak(latestMsg.text, isChinese ? "zh-CN" : "en-US");
  //     }
  //   }
  //   prevMessagesCountRef.current = messages.length;
  // }, [messages, speak]);

  // // When the user switches conversations or exits, immediately stop the current speech
  // useEffect(() => {
  //   stop();
  //   shouldSpeakNextAIReplyRef.current = false;
  // }, [activeConversationId, stop]);

  // useEffect(() => {
  //   if (renamingId && renameInputRef.current) {
  //     renameInputRef.current.focus();
  //     renameInputRef.current.select();
  //   }
  // }, [renamingId]);

  // useEffect(() => {
  //   const close = () => setMenuOpenId(null);
  //   if (menuOpenId) {
  //     window.addEventListener("click", close);
  //     return () => window.removeEventListener("click", close);
  //   }
  // }, [menuOpenId]);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  );
  const activeTitle = activeConversation?.title || "New check";
  const hasMessages = messages.length > 0;


  // const beginRename = (conversation: ManualConversationSummary) => {
  //   setRenamingId(conversation.id);
  //   setRenameValue(conversation.title || "New check");
  //   setMenuOpenId(null);
  // };

  // const commitRename = () => {
  //   if (!renamingId) return;
  //   const next = renameValue.trim();
  //   if (next) {
  //     onRenameConversation(renamingId, next);
  //   }
  //   setRenamingId(null);
  // };

  // const requestDelete = (conversation: ManualConversationSummary) => {
  //   setMenuOpenId(null);
  //   if ((conversation.message_count || 0) > 0) {
  //     setConfirmDeleteId(conversation.id);
  //   } else {
  //     onDeleteConversation(conversation.id);
  //   }
  // };

  // const confirmDelete = () => {
  //   if (!confirmDeleteId) return;
  //   onDeleteConversation(confirmDeleteId);
  //   setConfirmDeleteId(null);
  // };

  return (
    <div className="manual-workspace">
      <section className="manual-main" aria-label="Scam check workspace">
        {/* [HIDDEN_FOR_PUBLIC_VERSION] Title+subtitle hidden when empty — hero already conveys the same */}
        {hasMessages && (
          <header className="manual-main-header">
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
                        {/* Active conversation tools use the existing overflow menu. */}
                        <button type="button" role="menuitem" onClick={() => {
                          setMenuOpenId(null);
                          onExportReport();
                        }}>Export Report</button>
                        <button type="button" role="menuitem" onClick={() => {
                          setMenuOpenId(null);
                          setConfirmReset(true);
                        }}>Reset Profile</button>
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
          </header>
        )}

        <ChatMessageList
          onPreviewAttachment={(attachment, trigger) => {
            previewTrigger.current = trigger;
            setPreview(attachment);
            setPreviewOpen(true);
          }}
          messages={messages}
          isLoading={isLoading}
          onPasteMessage={() =>
            handleEmptyStatePaste(
              onSendMessage,
              markNextReplyToSpeak,
              onUploadImage,
            )
          }
          onUploadImage={handleOpenExplorer}
          onGeneralQuestion={handleNextQuestion}
        />

        <ChatComposer
          ref={composerRef}
          isLoading={isLoading}
          onSendMessage={(text, isVoice) => {
            // shouldSpeakNextAIReplyRef.current = isVoice;
            markNextReplyToSpeak(isVoice);
            onSendMessage(text);
          }}
          onUploadImage={onUploadImage}
        />
      </section>

      <aside
        className={`manual-preview-drawer${previewOpen ? " is-open" : ""}`}
        aria-label="Attachment preview"
        aria-hidden={!previewOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape") closePreview();
        }}
      >
        {preview && (
          <div className="manual-preview-content">
            <header className="manual-preview-header">
              <span title={preview.name}>{preview.name}</span>
              <button
                ref={closePreviewButton}
                type="button"
                className="manual-icon-btn manual-preview-close"
                aria-label="Close attachment preview"
                disabled={!previewOpen}
                onClick={closePreview}
              >
                <CloseIcon />
              </button>
            </header>
            {preview.isPdf ? (
              <div className="manual-preview-pdf">
                {previewOpen && readyPdf === preview ? (
                  <iframe src={pdfPreviewUrl(preview.src)} title={preview.name} />
                ) : (
                  <div className="manual-preview-pdf-placeholder" role="status">
                    Loading document...
                  </div>
                )}
              </div>
            ) : (
              <div className="manual-preview-image">
                <img src={preview.src} alt={preview.name} />
              </div>
            )}
          </div>
        )}
      </aside>

      <ConfirmModal
        isOpen={confirmReset}
        title="Reset user profile?"
        description="This resets adaptive voice/text settings back to standard mode."
        confirmText="Reset Profile"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          onResetProfile();
          setResetToast(true);
        }}
      />
      <div role="status" className={resetToast ? "manual-reset-toast" : undefined}>
        {resetToast && "Profile reset to standard mode."}
      </div>

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
