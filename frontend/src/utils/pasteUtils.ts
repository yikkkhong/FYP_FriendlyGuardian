import React from "react";

export const handlePasteImage = (
  e: React.ClipboardEvent<HTMLTextAreaElement>,
  onSelectImage: (file: File) => void,
) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.indexOf("image") !== -1) {
      const file = item.getAsFile();
      if (file) {
        onSelectImage(file);
        e.preventDefault(); // Prevent pasting binary data into text fields
        break;
      }
    }
  }
};

export const handleEmptyStatePaste = async (
  onSendMessage: (text: string) => void,
  markNextReplyToSpeak: (shouldSpeak: boolean) => void,
  onSelectImage: (file: File) => void,
) => {
  try {
    const items = await navigator.clipboard.read();

    for (const item of items) {
      // check got image
      const imgType = item.types.find((t) => t.startsWith("image/"));
      if (imgType) {
        const blob = await item.getType(imgType);
        const file = new File([blob], `paste-${Date.now()}.png`, {
          type: imgType,
        });
        onSelectImage(file); // Different paths, same result, both pass a `File` to this function.
        return;
      }

      // check got text
      if (item.types.includes("text/plain")) {
        const blob = await item.getType("text/plain");
        const text = (await blob.text()).trim();
        if (text) {
          markNextReplyToSpeak?.(false);
          onSendMessage(text);
          return;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to read clipboard:", err);
  }
};
