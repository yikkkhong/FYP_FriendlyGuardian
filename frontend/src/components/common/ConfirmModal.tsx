import React from "react";

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
  // Use the caller's confirmation copy for both delete and profile reset.
  const titleId = React.useId();
  const descriptionId = React.useId();
  if (!isOpen) return null;

  return (
    <div className="manual-confirm-backdrop" role="presentation">
      <div
        className="manual-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="manual-confirm-actions">
          <button
            type="button"
            className="manual-confirm-cancel"
            autoFocus
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={confirmText === "Delete" ? "manual-confirm-delete" : "manual-confirm-accept"}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
