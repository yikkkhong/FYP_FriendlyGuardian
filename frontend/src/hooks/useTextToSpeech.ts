import { useState, useEffect, useCallback } from "react";

export default function useTextToSpeech(defaultLang = "zh-CN") {
  // The switch state is stored in `localStorage`, so it persists after a page refresh (meaning if an elderly person turns it on once, it stays on).
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem("tts-enabled") !== "false";
  });
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(
    (text: string, lang?: string) => {
      if (!enabled || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel(); // stop speech if other speaking

      // Clean out the Markdown symbols to prevent the AI ​​from reading out odd things like "**".
      const clean = text
        .replace(/[*#_`~>\[\]()]/g, "")
        .replace(/https?:\/\/\S+/g, "link");
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang ?? defaultLang;
      u.rate = 0.95; // speak speed, 1 is normal, 0.5 is slow, 2 is fast
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [enabled, defaultLang],
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
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

  return { enabled, speaking, speak, stop, toggleEnabled };
}
