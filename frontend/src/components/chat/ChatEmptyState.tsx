// the elements display before starting conversation (empty / initial state)
// such as the 3 default button, center text
// after started conversation, all of them disappear

// why 3 button don't want just put at ChatEmptyState.tsx?:
// 3 button's function need to get other components' things for example where to put message, where to open file explorer
// ChatEmptyState.tsx only include the empty state elements
// so just use from other components that manage the conversation, so no need duplicate

import React from "react";
import { GuardianMark, PhoneIcon, CameraIcon, MenuIcon } from "../icons/Icons";

interface ChatEmptyStateProps {
  isLoading: boolean;
  onPasteMessage: () => void;
  onUploadImage: () => void;
  onGeneralQuestion: () => void;
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
  isLoading,
  onPasteMessage,
  onUploadImage,
  onGeneralQuestion,
}) => {
  return (
    <div className="manual-empty-state">
      <div className="guardian-orb" aria-hidden="true">
        <GuardianMark />
      </div>
      <h2>Is this a scam?</h2>
      <p>
        Paste a suspicious SMS, email, link, or bank account — your Guardian
        checks it instantly.
      </p>
      <div className="manual-suggestion-chips">
        {/* <button
                  type="button"
                  className="manual-suggestion-chip"
                  onClick={() =>
                    setQueryInput("Is this bank account number safe?")
                  }
                  disabled={isLoading}
                >
                  <BankIcon /> Check bank account
                </button> */}
        <button
          type="button"
          className="manual-suggestion-chip"
          //   onClick={() => handlePaste()}
          onClick={onPasteMessage}
          disabled={isLoading}
        >
          <PhoneIcon /> Paste Message
        </button>
        <button
          type="button"
          className="manual-suggestion-chip"
          //   onClick={() => handleOpenExplorer()}
          onClick={onUploadImage}
          disabled={isLoading}
        >
          <CameraIcon /> Upload Image
        </button>
        <button
          type="button"
          className="manual-suggestion-chip"
          //   onClick={() => handleNextQuestion()}
          onClick={onGeneralQuestion}
          disabled={isLoading}
        >
          <MenuIcon /> General Question
        </button>
      </div>
      <p className="hero-no-signup">No sign-up needed · Free to use</p>
    </div>
  );
};

export default ChatEmptyState;
