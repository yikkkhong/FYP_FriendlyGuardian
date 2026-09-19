const fs = require("fs");
const path = require("path");

const CHAT_FILE_PATH = path.join(__dirname, "chat_memory.json");

// Initialize the file structure for a single session
if (!fs.existsSync(CHAT_FILE_PATH)) {
  fs.writeFileSync(
    CHAT_FILE_PATH,
    JSON.stringify(
      { summary: "", messages: [], archived_messages: [] },
      null,
      2,
    ),
    "utf-8",
  );
}

class ChatMemory {
  constructor(maxRecentMessages = 10) {
    this.maxRecentMessages = maxRecentMessages;
  }

  readMemory() {
    try {
      const data = fs.readFileSync(CHAT_FILE_PATH, "utf-8");
      return JSON.parse(data || "{}");
    } catch (err) {
      console.error("⚠️ Error reading chat_memory.json:", err);
      return { summary: "", messages: [], archived_messages: [] };
    }
  }

  writeMemory(data) {
    try {
      fs.writeFileSync(CHAT_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("⚠️ Error writing chat_memory.json:", err);
    }
  }

  // Add a single record
  addMessage(role, text) {
    const data = this.readMemory();
    data.messages.push({
      role,
      text,
      timestamp: new Date().toISOString(),
    });
    this.writeMemory(data);
    return data;
  }

  // Constructing the conversation memory context for Gemini
  getChatContext() {
    const data = this.readMemory();
    const summaryPart = data.summary
      ? `Previous Context Summary:\n${data.summary}`
      : "No previous context summary.";

    const messagesPart =
      data.messages.length > 0
        ? data.messages
            .map(
              (m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`,
            )
            .join("\n")
        : "No previous messages.";

    return `${summaryPart}\n\nRecent Messages:\n${messagesPart}`;
  }

  // if reach maximum then archive and summary
  archiveOldMessages(newSummary, count) {
    const data = this.readMemory();
    const toArchive = data.messages.slice(0, count);

    data.archived_messages = [...(data.archived_messages || []), ...toArchive];
    data.messages = data.messages.slice(count);
    data.summary = newSummary;

    this.writeMemory(data);
  }

  getMessages() {
    return this.readMemory().messages || [];
  }

  getSummary() {
    return this.readMemory().summary || "";
  }

  clear() {
    this.writeMemory({ summary: "", messages: [], archived_messages: [] });
  }
}

module.exports = new ChatMemory(10);
