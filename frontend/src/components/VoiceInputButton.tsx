import { useEffect, useRef, useState } from "react";

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
}
type SpeechRecognitionConstructor = new () => ISpeechRecognition;

const SpeechRecognitionCtor: SpeechRecognitionConstructor | null =
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition ||
  null;

// ---------- for external interface ----------
interface VoiceInputButtonProps {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void; //  optional：Temporary text displayed while speaking
  lang?: string; // "zh-CN" | "en-US" | "ms-MY"
  disabled?: boolean;
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24">
      <path
        fill="currentColor"
        d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 
      1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 
      3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24">
      <path
        fill="currentColor"
        d="M6 6h12v12H6z"
      />
    </svg>
  );
}

export default function VoiceInputButton({
  onResult,
  onInterim,
  lang = "en-US",
  disabled = false,
}: VoiceInputButtonProps) {
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer for elapsed time
  useEffect(() => {
    if (listening && startTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [listening, startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const toggle = () => {
    if (!SpeechRecognitionCtor) {
      setError("Voice input not supported. Please use Chrome or Edge.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    // Clear previous error
    setError(null);
    setInterimText("");
    setElapsed(0);
    setStartTime(Date.now());

    // Haptic feedback if supported
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }

    const rec = new SpeechRecognitionCtor();
    recognitionRef.current = rec;
    rec.lang = lang;
    rec.continuous = false; // It plays in segments, pausing between them, and stops automatically when finished.
    rec.interimResults = true; // Intermediate results are also returned (for live preview)

    rec.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) {
        setInterimText(interim);
        onInterim?.(interim);
      }
      if (finalText) onResult(finalText.trim());
    };

    rec.onend = () => {
      setListening(false);
      setInterimText("");
      setStartTime(null);
      onInterim?.("");
      // Haptic feedback on stop
      if ("vibrate" in navigator) {
        navigator.vibrate(30);
      }
    };

    rec.onerror = (e) => {
      console.error("Speech recognition error:", e.error);
      setListening(false);
      setStartTime(null);
      switch (e.error) {
        case "not-allowed":
          setError("Microphone access denied. Please allow microphone permission.");
          break;
        case "no-speech":
          setError("No speech detected. Please try again.");
          break;
        case "network":
          setError("Network error. Please check your connection.");
          break;
        default:
          setError("I couldn't hear you. Please try again, or type your message.");
      }
    };

    rec.start();
    setListening(true);
  };

  // Stop recording when the component is removed
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  if (!SpeechRecognitionCtor) return null; // button no display in unsupported browsers

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        title={listening ? "Tap to stop" : "Tap to speak"}
        disabled={disabled}
        className={`query-upload-btn query-voice-btn ${listening ? "is-listening" : ""}`}
        aria-label={listening ? "Stop listening" : "Start voice input"}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {listening ? <StopIcon /> : <MicIcon />}
      </button>

      {/* Voice overlay when listening */}
      {listening && (
        <div className="voice-overlay" role="dialog" aria-modal="true" aria-label="Voice input active">
          <div className="voice-overlay-content">
            <div className="voice-status">
              <div className="voice-pulse-ring"></div>
              <div className="voice-pulse-ring voice-pulse-ring-2"></div>
              <div className="voice-pulse-ring voice-pulse-ring-3"></div>
              <div className="voice-icon">
                <MicIcon />
              </div>
            </div>
            <h2 className="voice-title">Listening...</h2>
            <p className="voice-subtitle">Speak now, or tap to stop</p>
            {interimText && (
              <p className="voice-transcript" aria-live="polite">
                "{interimText}"
              </p>
            )}
            <p className="voice-timer">{formatTime(elapsed)}</p>
            <div className="voice-actions">
              <button
                type="button"
                className="voice-action-btn voice-action-cancel"
                onClick={toggle}
                aria-label="Cancel voice input"
              >
                Cancel
              </button>
              <button
                type="button"
                className="voice-action-btn voice-action-done"
                onClick={() => {
                  if (interimText) {
                    onResult(interimText.trim());
                  }
                  toggle();
                }}
                disabled={!interimText}
                aria-label="Send voice input"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="voice-error-toast" role="alert" aria-live="assertive">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
