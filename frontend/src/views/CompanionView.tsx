import React, { useState } from "react";
import { PixelFace, EmotionState } from "../components/PixelFace";

interface CompanionViewProps {
  aiEmotion: EmotionState;
  isSpeaking: boolean;
  baymaxResponse: string;
  isWaitingAi: boolean;
  onSendMessage: (message: string) => void;
}

export const CompanionView: React.FC<CompanionViewProps> = ({
  aiEmotion,
  isSpeaking,
  baymaxResponse,
  isWaitingAi,
  onSendMessage,
}) => {
  const [chatInput, setChatInput] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isWaitingAi) return;

    onSendMessage(chatInput);
    setChatInput("");
  };

  return (
    <div
      className={`experience-theatre ${isSpeaking ? "layout-split" : "layout-centered"}`}
    >
      {/*pixel face with css transition */}
      <section className="actor-face-zone">
        <PixelFace emotion={aiEmotion} isSpeaking={isSpeaking} />
      </section>

      {/* right side show subtitle */}
      <section className="actor-dialogue-zone">
        <div className="speech-caption-card">
          <div className="speech-badge-row">
            <span className="dialogue-tag">
              {isWaitingAi
                ? "ANALYZING INTENT"
                : isSpeaking
                  ? "LIVE VOICE"
                  : "SYSTEM READY"}
            </span>
            {isSpeaking && (
              <div className="voice-waves">
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <p className="caption-body-text">“{baymaxResponse}”</p>
        </div>

        {/* input field */}
        <form onSubmit={handleSubmit} className="bottom-query-capsule">
          <input
            type="text"
            placeholder="Ask Baymax anything..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="query-input"
            disabled={isWaitingAi}
          />
          <button
            type="submit"
            className="query-submit-action"
            disabled={isWaitingAi}
          >
            {isWaitingAi ? "..." : "Speak"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default CompanionView;
