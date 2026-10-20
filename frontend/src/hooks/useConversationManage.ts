// manage temporary state that not display staticly
// such as delete-confirmation UI, rename input field and so on

import { useState, useRef, useEffect } from "react";
import { ManualConversationSummary } from "../views/ManualView";

interface UseConversationManageOptions {
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
}

export function useConversationManage({
  onRenameConversation,
  onDeleteConversation,
}: UseConversationManageOptions) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);

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
  return {
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
  };
}

export default useConversationManage;
