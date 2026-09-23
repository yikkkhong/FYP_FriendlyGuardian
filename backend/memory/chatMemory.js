const fs = require("fs");
const path = require("path");

const CHAT_FILE_PATH = path.join(__dirname, "chat_memory.json");
const MANUAL_UPLOAD_ROOT = path.join(__dirname, "..", "uploads", "manual");

function createEmptyStore() {
  return { activeConversationId: null, conversations: [] };
}

function createConversationObject(title = "New check") {
  const now = new Date().toISOString();
  return {
    id: `MANUAL-${Date.now()}`,
    title,
    summary: "",
    messages: [],
    archived_messages: [],
    created_at: now,
    updated_at: now,
  };
}

function migrateLegacy(data) {
  if (data && Array.isArray(data.conversations)) {
    return data;
  }

  const store = createEmptyStore();
  if (
    data &&
    (data.messages?.length > 0 ||
      data.summary ||
      data.archived_messages?.length > 0)
  ) {
    const conversation = createConversationObject("Previous checks");
    conversation.summary = data.summary || "";
    conversation.messages = data.messages || [];
    conversation.archived_messages = data.archived_messages || [];
    store.conversations = [conversation];
    store.activeConversationId = conversation.id;
  }
  return store;
}

function removeDirSafe(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error("⚠️ Error removing manual upload dir:", err);
  }
}

if (!fs.existsSync(CHAT_FILE_PATH)) {
  fs.writeFileSync(
    CHAT_FILE_PATH,
    JSON.stringify(createEmptyStore(), null, 2),
    "utf-8",
  );
}

if (!fs.existsSync(MANUAL_UPLOAD_ROOT)) {
  fs.mkdirSync(MANUAL_UPLOAD_ROOT, { recursive: true });
}

class ChatMemory {
  constructor(maxRecentMessages = 10) {
    this.maxRecentMessages = maxRecentMessages;
    const store = this.readStore();
    this.activeConversationId = store.activeConversationId || null;
  }

  getManualUploadRoot() {
    return MANUAL_UPLOAD_ROOT;
  }

  readStore() {
    try {
      const raw = fs.readFileSync(CHAT_FILE_PATH, "utf-8");
      return migrateLegacy(JSON.parse(raw || "{}"));
    } catch (err) {
      console.error("⚠️ Error reading chat_memory.json:", err);
      return createEmptyStore();
    }
  }

  writeStore(store) {
    try {
      store.activeConversationId = this.activeConversationId;
      fs.writeFileSync(CHAT_FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
    } catch (err) {
      console.error("⚠️ Error writing chat_memory.json:", err);
    }
  }

  ensureActiveConversation() {
    const store = this.readStore();
    if (
      this.activeConversationId &&
      store.conversations.some((c) => c.id === this.activeConversationId)
    ) {
      return this.getConversation(this.activeConversationId);
    }

    if (store.conversations.length > 0) {
      this.activeConversationId = store.conversations[0].id;
      this.writeStore(store);
      return store.conversations[0];
    }

    return null;
  }

  createConversation(title = "New check") {
    const store = this.readStore();
    const conversation = createConversationObject(title);
    store.conversations.unshift(conversation);
    this.activeConversationId = conversation.id;
    this.writeStore(store);

    const uploadDir = path.join(MANUAL_UPLOAD_ROOT, conversation.id);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    console.log(`💬 [Manual] Created: ${conversation.id} - ${title}`);
    return conversation;
  }

  getConversation(conversationId) {
    const store = this.readStore();
    return store.conversations.find((c) => c.id === conversationId) || null;
  }

  getAllConversations() {
    return this.readStore().conversations.map((c) => ({
      id: c.id,
      title: c.title,
      created_at: c.created_at,
      updated_at: c.updated_at,
      message_count: (c.messages || []).length,
      preview: this.getPreview(c),
    }));
  }

  getPreview(conversation) {
    const firstUser = (conversation.messages || []).find(
      (m) => m.role === "user",
    );
    if (!firstUser) return "";
    if (firstUser.imageUrl) {
      return firstUser.imageName
        ? `Image: ${firstUser.imageName}`
        : "Uploaded image";
    }
    const text = String(firstUser.text || "").replace(/\s+/g, " ").trim();
    return text.length > 72 ? `${text.slice(0, 72)}…` : text;
  }

  getActiveConversationId() {
    const conversation = this.ensureActiveConversation();
    return conversation?.id || null;
  }

  getActiveConversation() {
    return this.ensureActiveConversation();
  }

  switchConversation(conversationId) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return null;
    this.activeConversationId = conversationId;
    const store = this.readStore();
    this.writeStore(store);
    console.log(`🔄 [Manual] Switched to: ${conversationId}`);
    return conversation;
  }

  renameConversation(conversationId, title) {
    const cleaned = String(title || "").replace(/\s+/g, " ").trim();
    if (!cleaned) return null;

    const store = this.readStore();
    const index = store.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return null;

    store.conversations[index].title = cleaned.slice(0, 80);
    store.conversations[index].updated_at = new Date().toISOString();
    this.writeStore(store);
    return store.conversations[index];
  }

  titleFromText(text) {
    const cleaned = String(text || "")
      .replace(/^\[Uploaded Screenshot:[^\]]*\]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return "New check";
    return cleaned.length > 48 ? `${cleaned.slice(0, 48)}…` : cleaned;
  }

  maybeSetTitle(conversationId, userText, extras = {}) {
    const store = this.readStore();
    const index = store.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return;

    const conversation = store.conversations[index];
    const userMessages = (conversation.messages || []).filter(
      (m) => m.role === "user",
    );

    if (
      userMessages.length <= 1 &&
      (!conversation.title ||
        conversation.title === "New check" ||
        conversation.title === "New Conversation")
    ) {
      if (extras.imageName) {
        conversation.title = this.titleFromText(
          extras.imageName.replace(/\.[^.]+$/, ""),
        );
      } else {
        conversation.title = this.titleFromText(userText);
      }
      conversation.updated_at = new Date().toISOString();
      store.conversations[index] = conversation;
      this.writeStore(store);
    }
  }

  /**
   * @param {string} role
   * @param {string} text
   * @param {string|null} conversationId
   * @param {{ imageUrl?: string, imageName?: string, messageType?: string, ocrText?: string }} extras
   */
  addMessage(role, text, conversationId = null, extras = {}) {
    let id = conversationId || this.getActiveConversationId();

    if (!id) {
      id = this.createConversation().id;
    }

    const store = this.readStore();
    const index = store.conversations.findIndex((c) => c.id === id);

    if (index === -1) {
      id = this.createConversation().id;
      return this.addMessage(role, text, id, extras);
    }

    const conversation = store.conversations[index];
    const message = {
      role,
      text: text || "",
      timestamp: new Date().toISOString(),
    };

    if (extras.imageUrl) message.imageUrl = extras.imageUrl;
    if (extras.imageName) message.imageName = extras.imageName;
    if (extras.messageType) message.messageType = extras.messageType;
    if (extras.ocrText) message.ocrText = extras.ocrText;

    conversation.messages.push(message);
    conversation.updated_at = new Date().toISOString();
    store.conversations[index] = conversation;

    store.conversations.sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
    );

    this.writeStore(store);

    if (role === "user") {
      this.maybeSetTitle(id, text, extras);
    }

    return conversation;
  }

  getChatContext(conversationId = null) {
    const id = conversationId || this.getActiveConversationId();
    const conversation = this.getConversation(id);

    if (!conversation) {
      return "No previous context summary.\n\nRecent Messages:\nNo previous messages.";
    }

    const summaryPart = conversation.summary
      ? `Previous Context Summary:\n${conversation.summary}`
      : "No previous context summary.";

    const messagesPart =
      conversation.messages.length > 0
        ? conversation.messages
            .map((m) => {
              const label = m.role === "user" ? "User" : "Assistant";
              const body =
                m.ocrText ||
                m.text ||
                (m.imageUrl ? "[User uploaded an image for analysis]" : "");
              const typeHint = m.messageType
                ? ` [${m.messageType}]`
                : "";
              return `${label}${typeHint}: ${body}`;
            })
            .join("\n")
        : "No previous messages.";

    return `${summaryPart}\n\nRecent Messages:\n${messagesPart}`;
  }

  archiveOldMessages(newSummary, count, conversationId = null) {
    const store = this.readStore();
    const id = conversationId || this.activeConversationId;
    const index = store.conversations.findIndex((c) => c.id === id);
    if (index === -1) return;

    const conversation = store.conversations[index];
    const toArchive = conversation.messages.slice(0, count);

    conversation.archived_messages = [
      ...(conversation.archived_messages || []),
      ...toArchive,
    ];
    conversation.messages = conversation.messages.slice(count);
    conversation.summary = newSummary;
    conversation.updated_at = new Date().toISOString();

    store.conversations[index] = conversation;
    this.writeStore(store);
  }

  getMessages(conversationId = null) {
    const id = conversationId || this.getActiveConversationId();
    const conversation = this.getConversation(id);
    return conversation?.messages || [];
  }

  getSummary(conversationId = null) {
    const id = conversationId || this.getActiveConversationId();
    const conversation = this.getConversation(id);
    return conversation?.summary || "";
  }

  clear(conversationId = null) {
    if (!conversationId) {
      const store = this.readStore();
      for (const c of store.conversations || []) {
        removeDirSafe(path.join(MANUAL_UPLOAD_ROOT, c.id));
      }
      this.activeConversationId = null;
      this.writeStore(createEmptyStore());
      return;
    }

    const store = this.readStore();
    store.conversations = store.conversations.filter(
      (c) => c.id !== conversationId,
    );
    if (this.activeConversationId === conversationId) {
      this.activeConversationId = store.conversations[0]?.id || null;
    }
    this.writeStore(store);
    removeDirSafe(path.join(MANUAL_UPLOAD_ROOT, conversationId));
  }

  toClientMessages(conversationId = null) {
    const messages = this.getMessages(conversationId);
    return messages.map((m) => ({
      sender: m.role === "user" ? "user" : "ai",
      text: m.text || "",
      time: m.timestamp
        ? new Date(m.timestamp).toLocaleTimeString()
        : new Date().toLocaleTimeString(),
      imageUrl: m.imageUrl || undefined,
      imageName: m.imageName || undefined,
      messageType: m.messageType || undefined,
    }));
  }
}

module.exports = new ChatMemory(10);
