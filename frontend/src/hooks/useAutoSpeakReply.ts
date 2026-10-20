// manage the AI when should talk and when should not talk

import { useEffect, useRef } from "react";
import useTextToSpeech from "./useTextToSpeech";
import { ManualMessage } from "../views/ManualView";

interface UseAutoSpeakReplyOptions {
  messages: ManualMessage[];
  activeConversationId: string | null;
}

export function useAutoSpeakReply({
  messages,
  activeConversationId,
}: UseAutoSpeakReplyOptions) {
  // use text to speech hook
  const { speak, stop } = useTextToSpeech();
  // const isVoiceInputRef = useRef(false);
  const shouldSpeakNextAIReplyRef = useRef(false);
  const prevMessagesCountRef = useRef(messages.length);

  // Listen for new messages: If the current turn involves a voice conversation, the AI ​​automatically reads the response aloud.
  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current) {
      const latestMsg = messages[messages.length - 1];

      // Must be a new AI message, and the current conversation was triggered by voice
      if (
        latestMsg &&
        latestMsg.sender === "ai" &&
        shouldSpeakNextAIReplyRef.current
      ) {
        shouldSpeakNextAIReplyRef.current = false; // Reset the flag to avoid reading the next AI message aloud by default

        // Determine the language of the message based on whether it contains Chinese characters
        const isChinese = /[\u4e00-\u9fa5]/.test(latestMsg.text);
        speak(latestMsg.text, isChinese ? "zh-CN" : "en-US");
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages, speak]);

  // When the user switches conversations or exits, immediately stop the current speech
  useEffect(() => {
    stop();
    shouldSpeakNextAIReplyRef.current = false;
  }, [activeConversationId, stop]);

  const markNextReplyToSpeak = (shouldSpeak: boolean) => {
    shouldSpeakNextAIReplyRef.current = shouldSpeak;
  };

  return {
    markNextReplyToSpeak,
    stopSpeaking: stop,
  };
}

export default useAutoSpeakReply;
