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
    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
      <path
        fill="currentColor"
        d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 
      1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 
      3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
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
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const toggle = () => {
    if (!SpeechRecognitionCtor) {
      alert(
        "Your browser does not support voice input. Please use Chrome or Edge",
      );
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
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
      if (interim) onInterim?.(interim);
      if (finalText) onResult(finalText.trim());
    };

    rec.onend = () => {
      setListening(false);
      onInterim?.("");
    };
    rec.onerror = (e) => {
      console.error("Speech recognition error:", e.error);
      setListening(false);
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
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Stop" : "Voice Input"}
      // style={{
      //   width: 44,
      //   height: 44,
      //   borderRadius: "50%",
      //   border: "none",
      //   cursor: "pointer",
      //   fontSize: 20,
      //   flexShrink: 0,
      //   backgroundColor: listening ? "#e53935" : "#f0f0f0",
      //   color: listening ? "#fff" : "#333",
      // }}

      disabled={disabled}
      className={`query-upload-btn query-voice-btn ${listening ? "is-listening" : ""}`}
      aria-label={listening ? "Stop" : "Start"}
    >
      <MicIcon />
      {/* {listening ? "⏹" : "🎤"} */}
    </button>
  );
}
