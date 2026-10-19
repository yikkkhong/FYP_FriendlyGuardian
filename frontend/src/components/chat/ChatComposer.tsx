// chat bottom input field
// including keyboard typing, voice input, image upload
// everything used to input to system

import React, {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import VoiceInputButton, { VoiceInputHandle } from "../common/VoiceInputButton";
import { CameraIcon, CloseIcon } from "../icons/Icons";

const API_ORIGIN = "http://localhost:5000";

export interface ChatComposerHandle {
  setQueryText: (text: string) => void;
  appendQueryText: (text: string) => void;
  openFilePicker: () => void;
}

interface ChatComposerProps {
  isLoading: boolean;
  onSendMessage: (message: string, isFromVoice: boolean) => void;
  onUploadImage: (file: File) => void;
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  ({ isLoading, onSendMessage, onUploadImage }, ref) => {
    const [queryInput, setQueryInput] = useState("");
    const [voicePanelActive, setVoicePanelActive] = useState(false);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [voiceStartTime, setVoiceStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    const isVoiceInputRef = useRef(false);
    const textBeforeVoiceRef = useRef("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const voiceInputRef = useRef<VoiceInputHandle>(null);
    const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // let outside code
    useImperativeHandle(ref, () => ({
      setQueryText: (text: string) => {
        setQueryInput(text);
        textareaRef.current?.focus();
      },
      appendQueryText: (clipText: string) => {
        const textarea = textareaRef.current;
        if (!textarea) {
          setQueryInput(clipText);
          return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const nextText =
          queryInput.substring(0, start) + clipText + queryInput.substring(end);

        setQueryInput(nextText);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(
            start + clipText.length,
            start + clipText.length,
          );
        }, 0);
      },
      openFilePicker: () => {
        fileInputRef.current?.click();
      },
    }));

    // Auto-growing textarea
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
      }
    }, [queryInput]);

    // Voice timer
    useEffect(() => {
      if (voicePanelActive && voiceStartTime) {
        voiceTimerRef.current = setInterval(() => {
          setElapsedTime(Math.floor((Date.now() - voiceStartTime) / 1000));
        }, 1000);
      } else {
        if (voiceTimerRef.current) {
          clearInterval(voiceTimerRef.current);
          voiceTimerRef.current = null;
        }
      }
      return () => {
        if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      };
    }, [voicePanelActive, voiceStartTime]);

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const handleVoicePanelStateChange = (isActive: boolean) => {
      setVoicePanelActive(isActive);
      if (isActive) {
        textBeforeVoiceRef.current = queryInput;
        setVoiceStartTime(Date.now());
        setElapsedTime(0);
        setVoiceError(null);
      } else {
        setVoiceStartTime(null);
      }
    };

    const handleVoiceInterim = (text: string) => {
      if (!text.trim()) return;
      const prefix = textBeforeVoiceRef.current
        ? `${textBeforeVoiceRef.current} `
        : "";
      setQueryInput(prefix + text);
    };

    const handleVoiceResult = async (text: string) => {
      isVoiceInputRef.current = true;
      const prefix = textBeforeVoiceRef.current
        ? `${textBeforeVoiceRef.current} `
        : "";
      const fullText = prefix + text;
      setQueryInput(fullText);

      try {
        const response = await fetch(`${API_ORIGIN}/api/correct-speech`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText: text }),
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.correctedText) {
          setQueryInput(prefix + data.correctedText);
        }
      } catch (error) {
        console.warn(
          "Speech correction failed, keeping raw transcript:",
          error,
        );
      }
    };

    const handleCancelVoice = () => {
      voiceInputRef.current?.cancel();
      setVoicePanelActive(false);
      setVoiceError(null);
      setQueryInput(textBeforeVoiceRef.current);
      textBeforeVoiceRef.current = "";
    };

    const handleFinishVoice = () => {
      voiceInputRef.current?.stop();
      setVoicePanelActive(false);
      setVoiceError(null);
      textBeforeVoiceRef.current = "";
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!queryInput.trim() || isLoading) return;

      const wasVoice = isVoiceInputRef.current;
      onSendMessage(queryInput, wasVoice);
      setQueryInput("");
      isVoiceInputRef.current = false;
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || isLoading) return;
      onUploadImage(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
      <div className="manual-composer-wrapper">
        {/* Floating error pill above composer — non-intrusive, auto-dismissible */}
        {voiceError && (
          <div className="voice-error-banner" role="alert" aria-live="polite">
            <span className="voice-error-text">{voiceError}</span>
            <button
              type="button"
              className="voice-error-retry"
              onClick={() => {
                setVoiceError(null);
                voiceInputRef.current?.start();
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="voice-error-close"
              onClick={() => setVoiceError(null)}
              aria-label="Dismiss error"
            >
              x
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={`manual-composer ${voicePanelActive ? "is-voice-listening" : ""}`}
        >
          {/* [HIDDEN_FOR_PUBLIC_VERSION] Voice scrim overlay commented out for flat, unblurred experience */}
          {/* {voicePanelActive && (
                      <div className="voice-scrim" onClick={(e) => e.preventDefault()} />
                    )} */}

          <input
            type="file"
            ref={fileInputRef}
            className="manual-file-input"
            accept="image/*"
            onChange={handleImageUpload}
          />

          {/* Camera slot transforms into ghost Cancel (X) button when voice listening */}
          {voicePanelActive ? (
            <button
              type="button"
              className="query-cancel-btn"
              onClick={handleCancelVoice}
              aria-label="Cancel voice input"
              title="Cancel voice input"
            >
              <CloseIcon />
            </button>
          ) : (
            <button
              type="button"
              className="query-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              aria-label="Upload suspicious screenshot"
              title="Upload suspicious screenshot"
            >
              <CameraIcon />
            </button>
          )}

          <VoiceInputButton
            ref={voiceInputRef}
            onResult={handleVoiceResult}
            onInterim={handleVoiceInterim}
            lang="en-US"
            onPanelStateChange={handleVoicePanelStateChange}
            onError={setVoiceError}
          />

          {/* Balanced fancy soundwave equalizer animation while user is talking */}
          {voicePanelActive && (
            <div
              className="composer-voice-eq"
              aria-hidden="true"
              title="Listening to voice"
            >
              <span className="composer-voice-bar" />
              <span className="composer-voice-bar" />
              <span className="composer-voice-bar" />
              <span className="composer-voice-bar" />
            </div>
          )}

          {/* [HIDDEN_FOR_PUBLIC_VERSION] Large voice panel card modal commented out in favor of in-place pill transformation */}
          {/* {voicePanelActive && (
                      <div className="voice-panel-legacy">Legacy voice panel commented out</div>
                    )} */}

          <label htmlFor="manual-query-input" className="sr-only">
            Message or account to check
          </label>
          <textarea
            ref={textareaRef}
            id="manual-query-input"
            placeholder={
              voicePanelActive
                ? "Listening... speak now"
                : "Paste a message, ask a follow-up, or describe what you received…"
            }
            className="query-input"
            value={queryInput}
            aria-live={voicePanelActive ? "polite" : "off"}
            onChange={(e) => {
              const val = e.target.value;
              setQueryInput(val);
              if (voiceError) setVoiceError(null);
              if (!val.trim()) {
                isVoiceInputRef.current = false;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (voicePanelActive) {
                  handleCancelVoice();
                } else {
                  setQueryInput("");
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (voicePanelActive) {
                  handleFinishVoice();
                } else if (queryInput.trim() && !isLoading) {
                  handleSubmit(e);
                }
              }
            }}
            disabled={isLoading}
            autoComplete="off"
            rows={1}
            style={{
              resize: "none",
              height: "auto",
              minHeight: "44px",
              maxHeight: "150px",
              overflowY: "auto",
            }}
          />

          {/* Live timer when speaking */}
          {voicePanelActive && (
            <span className="composer-voice-timer" aria-live="off">
              {formatTime(elapsedTime)}
            </span>
          )}

          {/* Send button becomes Done button when voice listening */}
          {voicePanelActive ? (
            <button
              type="button"
              className="query-submit-action voice-done-btn"
              onClick={handleFinishVoice}
              aria-label="Finish speaking"
            >
              Done
            </button>
          ) : (
            <button
              type="submit"
              className="query-submit-action"
              disabled={isLoading || !queryInput.trim()}
            >
              {isLoading ? "…" : "Send"}
            </button>
          )}
        </form>
      </div>
    );
  },
);

export default ChatComposer;
