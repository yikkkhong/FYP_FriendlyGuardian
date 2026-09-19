// current maximum messages = 10

const fs = require("fs");
const path = require("path");

const CONVERSATION_FILE_PATH = path.join(__dirname, "conversation_memory.json");

// initialize conversation storage
if (!fs.existsSync(CONVERSATION_FILE_PATH)) {
  fs.writeFileSync(
    CONVERSATION_FILE_PATH,
    JSON.stringify([], null, 2),
    "utf-8",
  );
}

class ConversationMemory {
  constructor(maxRecentMessages = 10) {
    this.maxRecentMessages = maxRecentMessages;

    const conversations = this.readConversations();

    this.activeConversationId =
      conversations.length > 0 ? conversations[0].id : null;
  }

  // internal file helpers
  readConversations() {
    try {
      const data = fs.readFileSync(CONVERSATION_FILE_PATH, "utf-8");

      return JSON.parse(data || "[]");
    } catch (error) {
      console.error("🔥 Error reading conversation memory:", error);

      return [];
    }
  }

  writeConversations(conversations) {
    try {
      fs.writeFileSync(
        CONVERSATION_FILE_PATH,
        JSON.stringify(conversations, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error("🔥 Error writing conversation memory:", error);
    }
  }

  // Create new conversation
  createConversation(title = "New Conversation", topic = "general") {
    const conversations = this.readConversations();

    const now = new Date().toISOString();

    const conversation = {
      id: `CHAT-${Date.now()}`,
      title,
      topic,
      summary: "",
      messages: [],
      archived_messages: [],
      created_at: now,
      updated_at: now,
    };

    conversations.unshift(conversation);

    this.writeConversations(conversations);

    this.activeConversationId = conversation.id;

    console.log(`💬 [Conversation] Created: ${conversation.id} - ${title}`);

    return conversation;
  }

  // Get conversation
  getConversation(conversationId) {
    const conversations = this.readConversations();

    return (
      conversations.find(
        (conversation) => conversation.id === conversationId,
      ) || null
    );
  }

  // get all conversations
  getAllConversations() {
    return this.readConversations();
  }

  // get active conversation
  getActiveConversation() {
    if (!this.activeConversationId) {
      return null;
    }

    return this.getConversation(this.activeConversationId);
  }

  getActiveConversationId() {
    return this.activeConversationId;
  }

  //switch conversation
  switchConversation(conversationId) {
    const conversation = this.getConversation(conversationId);

    if (!conversation) {
      return null;
    }

    this.activeConversationId = conversationId;

    console.log(`🔄 [Conversation] Switched to: ${conversationId}`);

    return conversation;
  }

  // Add message
  addMessage(conversationId, role, text) {
    const conversations = this.readConversations();

    const conversationIndex = conversations.findIndex(
      (conversation) => conversation.id === conversationId,
    );

    if (conversationIndex === -1) {
      return null;
    }

    const conversation = conversations[conversationIndex];

    conversation.messages.push({
      role,
      text,
      timestamp: new Date().toISOString(),
    });

    conversation.updated_at = new Date().toISOString();

    // only keep recent messages in active context
    // if (
    //   conversation.messages.length >
    //   this.maxRecentMessages
    // ) {
    //   conversation.messages =
    //     conversation.messages.slice(
    //       -this.maxRecentMessages
    //     );
    // }

    conversation.updated_at = new Date().toISOString();

    conversations[conversationIndex] = conversation;

    this.writeConversations(conversations);

    return conversation;
  }

  archiveOldMessages(conversationId, newSummary, archivedCount) {
    const conversations = this.readConversations();
    const index = conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return null;

    const conversation = conversations[index];

    //archived and store old message in archived_messages
    const toArchive = conversation.messages.slice(0, archivedCount);
    conversation.archived_messages = [
      ...(conversation.archived_messages || []),
      ...toArchive,
    ];

    // only keep recent messages
    conversation.messages = conversation.messages.slice(archivedCount);

    // 3. uopdate summary
    conversation.summary = newSummary;
    conversation.updated_at = new Date().toISOString();

    conversations[index] = conversation;
    this.writeConversations(conversations);
    return conversation;
  }

  // get conversation context
  getConversationContext(conversationId) {
    const conversation = this.getConversation(conversationId);

    if (!conversation) {
      return "No previous conversation context.";
    }

    const summary = conversation.summary
      ? `Conversation Summary:\n${conversation.summary}`
      : "No conversation summary available.";

    const messages =
      conversation.messages.length > 0
        ? conversation.messages
            .map(
              (message) =>
                `${message.role === "user" ? "User" : "Baymax"}: ${message.text}`,
            )
            .join("\n")
        : "No previous messages.";

    return `
${summary}

Recent Messages:
${messages}
`;
  }

  // Search conversations
  searchConversations(keyword) {
    if (!keyword) {
      return [];
    }

    const conversations = this.readConversations();

    const lowerKeyword = keyword.toLowerCase();

    return conversations.filter(
      (conversation) =>
        conversation.title?.toLowerCase().includes(lowerKeyword) ||
        conversation.topic?.toLowerCase().includes(lowerKeyword) ||
        conversation.summary?.toLowerCase().includes(lowerKeyword),
    );
  }
}

const conversationMemory = new ConversationMemory(10);

module.exports = conversationMemory;
