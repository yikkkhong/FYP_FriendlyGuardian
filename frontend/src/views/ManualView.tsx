import React, { useState, useRef, useEffect } from "react";
import { MoreIcon } from "../components/icons/Icons";
import ConfirmModal from "../components/common/ConfirmModal";
import ChatMessageList from "../components/chat/ChatMessageList";
import ChatComposer, {
  ChatComposerHandle,
} from "../components/chat/ChatComposer";

import useTextToSpeech from "../hooks/useTextToSpeech";
import useAutoSpeakReply from "../hooks/useAutoSpeakReply";
import useConversationManage from "../hooks/useConversationManage";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      const trimmedText = clipText.trim(); //text without empty space
      //if no copy text or text is just empty space, then no send
      if (!clipText || !trimmedText) return;

      markNextReplyToSpeak(false); // in case like user clicked voice input and also clicked paste button

      // direct send
      onSendMessage(trimmedText);

      // show at input field
      //composerRef.current?.appendQueryText(clipText);
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

  const selectConversation = (id: string) => {
    if (id === activeConversationId || isLoading) return;
    onSelectConversation(id);
    setSidebarOpen(false);
    setMenuOpenId(null);
  };

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
        <header className="manual-main-header">
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
            // shouldSpeakNextAIReplyRef.current = isVoice;
            markNextReplyToSpeak(isVoice);
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
