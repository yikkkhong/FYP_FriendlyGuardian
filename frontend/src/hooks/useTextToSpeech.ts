import { createContext, useState, useEffect, useCallback, useSyncExternalStore } from "react";

// Browser narration is shared. Identify the message that owns the current utterance.
export const ReportSpeechRate = createContext(0.95);
let current: { utterance: SpeechSynthesisUtterance; owner?: object } | null = null;
const listeners = new Set<() => void>();
function setCurrent(next: typeof current) {
  current = next;
  listeners.forEach(notify => notify());
}
function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}
const snapshot = () => current;

export default function useTextToSpeech(defaultLang = "zh-CN") {
  // The switch state is stored in `localStorage`, so it persists after a page refresh (meaning if an elderly person turns it on once, it stays on).
  const [enabled, setEnabled] = useState(() => {
    return typeof localStorage === "undefined" || localStorage.getItem("tts-enabled") !== "false";
  });
  const active = useSyncExternalStore(subscribe, snapshot, () => null);

  const speak = useCallback(
    (text: string, lang?: string, rate = 0.95, owner?: object) => {
      if (!enabled || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel(); // stop speech if other speaking

      // Clean out the Markdown symbols to prevent the AI ​​from reading out odd things like "**".
      const clean = text
        .replace(/[*#_`~>\[\]()]/g, "")
        .replace(/https?:\/\/\S+/g, "link");
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang ?? defaultLang;
      u.rate = rate;
      u.onend = u.onerror = () => {
        if (current?.utterance === u) setCurrent(null);
      };
      setCurrent({ utterance: u, owner });
      window.speechSynthesis.speak(u);
    },
    [enabled, defaultLang],
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setCurrent(null);
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("tts-enabled", String(next));
      return next;
    });
  }, []);

  // If the user disables TTS while it is speaking, stop speaking immediately.
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  return { enabled, speaking: !!active, speechOwner: active?.owner, speak, stop, toggleEnabled };
}
