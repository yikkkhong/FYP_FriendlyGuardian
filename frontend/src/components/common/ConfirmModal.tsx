import React from "react";
import "../../styles/confirm-modal.css";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="manual-confirm-backdrop" role="presentation">
      <div
        className="manual-confirm-dialog"
        role="alertdialog"
        aria-labelledby="manual-delete-title"
        aria-describedby="manual-delete-desc"
      >
        <h2 id="manual-delete-title">Delete this check?</h2>
        <p id="manual-delete-desc">
          This removes the conversation and any uploaded images. This cannot be
          undone.
        </p>
        <div className="manual-confirm-actions">
          <button
            type="button"
            className="manual-confirm-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="manual-confirm-delete"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
