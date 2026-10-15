import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

// Web Speech API is not included in the default TypeScript types, so need to declare ourself
interface ISpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}
interface ISpeechRecognitionResult {
  isFinal: boolean;
  0: ISpeechRecognitionResultItem;
}
interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: ISpeechRecognitionResult;
  };
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}
type SpeechRecognitionConstructor = new () => ISpeechRecognition;

const SpeechRecognitionCtor: SpeechRecognitionConstructor | null =
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition ||
  null;

// External interface
export interface VoiceInputHandle {
  stop: () => void;
  cancel: () => void;
  start: () => void;
  isListening: boolean;
}

export interface VoiceInputButtonProps {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  lang?: string;
  disabled?: boolean;
  onPanelStateChange?: (isActive: boolean) => void;
  onError?: (error: string | null) => void;
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <rect x="5" y="5" width="14" height="14" rx="2.5" fill="white" />
    </svg>
  );
}

export const VoiceInputButton = forwardRef<VoiceInputHandle, VoiceInputButtonProps>(
  (
    {
      onResult,
      onInterim,
      lang = "en-US",
      disabled = false,
      onPanelStateChange,
      onError,
    },
    ref
  ) => {
    const [listening, setListening] = useState(false);
    const recognitionRef = useRef<ISpeechRecognition | null>(null);

    const stopListening = () => {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        console.warn("Speech stop warning:", e);
      }
    };

    const cancelListening = () => {
      try {
        if (recognitionRef.current?.abort) {
          recognitionRef.current.abort();
        } else {
          recognitionRef.current?.stop();
        }
      } catch (e) {
        console.warn("Speech abort warning:", e);
      }
      setListening(false);
      onInterim?.("");
      onPanelStateChange?.(false);
    };

    useImperativeHandle(ref, () => ({
      stop: stopListening,
      cancel: cancelListening,
      start: () => {
        if (!listening) toggle();
      },
      isListening: listening,
    }));

    const toggle = () => {
      if (!SpeechRecognitionCtor) {
        const msg = "Voice input is not supported in this browser. Please use Chrome or Edge.";
        onError?.(msg);
        return;
      }
      if (listening) {
        stopListening();
        return;
      }

      onError?.(null);
      onInterim?.("");

      if ("vibrate" in navigator) {
        navigator.vibrate(50);
      }

      const rec = new SpeechRecognitionCtor();
      recognitionRef.current = rec;
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (event) => {
        let interim = "";
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (interim) {
          onInterim?.(interim);
        }
        if (finalText) {
          onResult(finalText.trim());
        }
      };

      rec.onend = () => {
        setListening(false);
        onInterim?.("");
        onPanelStateChange?.(false);
        if ("vibrate" in navigator) {
          navigator.vibrate(30);
        }
      };

      rec.onerror = (e) => {
        console.error("Speech recognition error:", e.error);
        setListening(false);
        onInterim?.("");
        onPanelStateChange?.(false);

        let errMsg = "I couldn't hear you. Please try again or type your message.";
        if (e.error === "not-allowed") {
          errMsg = "Microphone access denied. Please allow microphone permission in your browser.";
        } else if (e.error === "no-speech") {
          errMsg = "I couldn't hear you. Please try again or type your message.";
        }
        onError?.(errMsg);
      };

      try {
        rec.start();
        setListening(true);
        onPanelStateChange?.(true);
      } catch (err) {
        console.error("Speech recognition failed to start:", err);
        setListening(false);
        onPanelStateChange?.(false);
        onError?.("Unable to start microphone. Please try again.");
      }
    };

    // Stop recording on unmount
    useEffect(() => {
      return () => {
        try {
          recognitionRef.current?.stop();
        } catch (_) {}
      };
    }, []);

    if (!SpeechRecognitionCtor) return null;

    return (
      <div className="voice-btn-container">
        {listening && (
          <>
            <span className="mic-pulse-ring" aria-hidden="true" />
            <span className="mic-pulse-wave" aria-hidden="true" />
          </>
        )}
        <button
          type="button"
          onClick={toggle}
          title={listening ? "Tap to finish speaking" : "Tap to speak"}
          disabled={disabled}
          className={`query-upload-btn query-voice-btn ${listening ? "is-listening" : ""}`}
          aria-label={listening ? "Stop listening" : "Start voice input"}
        >
          {listening ? <StopIcon /> : <MicIcon />}
        </button>
      </div>
    );
  }
);

VoiceInputButton.displayName = "VoiceInputButton";

export default VoiceInputButton;
