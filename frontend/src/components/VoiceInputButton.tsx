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
}

export default function VoiceInputButton({
  onResult,
  onInterim,
  lang = "zh-CN",
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
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        fontSize: 20,
        flexShrink: 0,
        backgroundColor: listening ? "#e53935" : "#f0f0f0",
        color: listening ? "#fff" : "#333",
      }}
    >
      {listening ? "⏹" : "🎤"}
    </button>
  );
}
