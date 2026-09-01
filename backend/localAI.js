const { pipeline, cos_sim } = require("@xenova/transformers");
const { STM, LTM } = require("./securityMemory.js");
const ConversationMemory = require("./conversationMemory");

let extractor = null;
let cachedIntentVectors = null;

//check timing create timer
function createTimer(label) {
  const start = performance.now();

  return {
    end(extra = "") {
      const elapsed = performance.now() - start;
      console.log(
        `⏱️ [${label}] ${elapsed.toFixed(0)} ms${extra ? ` - ${extra}` : ""}`,
      );
      return elapsed;
    },
  };
}

// 1. Define multilingual/Manglish semantic anchors for four categories of Memory Intents
const INTENT_PROTOTYPES = {
  CURRENT_SCAM: [
    "help me check any scam i received just now",
    "did i get any scam message recently?",
    "is this latest sms dangerous?",
    "tadi bank hantar message, is it real or fake?",
    "check the suspicious sms I got a few minutes ago",
    "ada scam baru masuk ke tadi?",
    "check my latest message",
    "is this new sms a scam?",
  ],
  SCAM_HISTORY: [
    "have i ever received any scam before this?",
    "show me all my past scam records",
    "how many scammers contacted me last month?",
    "what was that fake police account from previous incident?",
    "ada record kena tipu sebelum ini tak?",
    "list my historical scam incidents",
    "did i get any scam before?",
    "check my scam history",
    "any past scams recorded?",
  ],
  BOTH: [
    "is this new scam related to the one from last week?",
    "compare today's message with my old scam history",
    "did this same bank account appear in my previous records?",
    "adakah scammer tadi orang yang sama macam dulu?",
  ],
  GENERAL: [
    "hello how are you today?",
    "what is the weather like now?",
    "remind me to take my blood pressure medicine",
    "tell me a joke please",
    "thank you very much for your help",
    "apa khabar baymax",
    "guess what i bought today",
  ],
};

// 2. Initialize Local AI model and pre-compute intent embeddings
async function initLocalAI() {
  if (extractor) return;

  console.log("🧠 Loading paraphrase-multilingual-MiniLM-L12-v2...");
  extractor = await pipeline(
    "feature-extraction",
    "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  );
  console.log("✅ Local AI Model loaded into memory!");

  console.log("⚡ Pre-computing Intent Anchor Vectors...");
  cachedIntentVectors = {};
  for (const [intent, examples] of Object.entries(INTENT_PROTOTYPES)) {
    cachedIntentVectors[intent] = [];
    for (const text of examples) {
      const output = await extractor(text, {
        pooling: "mean",
        normalize: true,
      });
      cachedIntentVectors[intent].push(output.data);
    }
  }
  console.log("✅ All Intent Anchors cached in RAM!");
}

async function getVector(text) {
  if (!extractor) await initLocalAI();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return output.data;
}

// =========================
// 3. Task 1: Memory Intent

async function classifyMemoryIntent_Local(userText) {
  const userVec = await getVector(userText);
  let bestIntent = "GENERAL";
  let maxScore = -1;

  for (const [intent, vectors] of Object.entries(cachedIntentVectors)) {
    for (const anchorVec of vectors) {
      const score = cos_sim(userVec, anchorVec);
      if (score > maxScore) {
        maxScore = score;
        bestIntent = intent;
      }
    }
  }

  if (maxScore < 0.35) {
    bestIntent = "GENERAL";
  }

  //return { intent: bestIntent, confidence: maxScore.toFixed(3) };
  return bestIntent;
}

// ==========================================
// Task 2. Conversation Router (Semantic + Rules)
// ==========================================

// Contextual Intent Keyword Library
const CONTEXT_RULES = {
  // Recall/Return to previous topic
  RECALL_SWITCH: [
    "again",
    "earlier",
    "before",
    "previously",
    "last time",
    "back to",
    "remember",
    "we talked",
    "we discussed",
    "tadi cakap",
    "dulu",
    "semalam",
  ],
  // Pronouns and continuation markers (tending to continue the currently active conversation)
  CONTINUATION: [
    "it",
    "that",
    "this",
    "them",
    "then",
    "why",
    "so",
    "what about",
    "how about",
    "and",
    "next",
    "what should i do",
  ],
  // Explicitly request to start a new topic.
  NEW_TOPIC: [
    "new topic",
    "change topic",
    "something else",
    "by the way",
    "start new",
    "lain cerita",
  ],
};

function detectContextClues(text) {
  const lower = text.toLowerCase();

  const hasRecallCue = CONTEXT_RULES.RECALL_SWITCH.some((w) =>
    new RegExp(`\\b${w}\\b`, "i").test(lower),
  );
  const hasContinuationCue = CONTEXT_RULES.CONTINUATION.some((w) =>
    new RegExp(`\\b${w}\\b`, "i").test(lower),
  );
  const hasNewTopicCue = CONTEXT_RULES.NEW_TOPIC.some((w) =>
    new RegExp(`\\b${w}\\b`, "i").test(lower),
  );

  return { hasRecallCue, hasContinuationCue, hasNewTopicCue };
}

// temporary let everything be linear
// add back conversation route NEW CONTINUE SWITCH next time

// async function routeConversation_Local(
//   userText,
//   activeConversation,
//   allConversations = [],
// ) {
//   if (
//     !activeConversation &&
//     (!allConversations || allConversations.length === 0)
//   ) {
//     return {
//       action: "NEW",
//       conversation_id: "",
//       reason: "No conversations exist.",
//     };
//   }

//   // 1. Contextual Clue Detection (0ms)
//   const clues = detectContextClues(userText);

//   // Explicitly request to start a new topic
//   if (clues.hasNewTopicCue) {
//     return {
//       action: "NEW",
//       conversation_id: "",
//       reason: "Rule: Explicit new topic request.",
//     };
//   }

//   // 2. Semantic Embedding and Similarity Calculation (15ms - 30ms)
//   const userVec = await getVector(userText);

//   async function calcConvMaxScore(conv) {
//     if (!conv) return 0;
//     const titleVec = await getVector(conv.title || "");
//     const topicVec = await getVector(conv.topic || "");
//     const summaryVec = conv.summary ? await getVector(conv.summary) : null;

//     const sTitle = cos_sim(userVec, titleVec);
//     const sTopic = cos_sim(userVec, topicVec);
//     const sSummary = summaryVec ? cos_sim(userVec, summaryVec) : 0;

//     return Math.max(sTitle, sTopic, sSummary);
//   }

//   // Calculate similarity scores for active conversation and all historical conversations
//   let currentScore = 0;
//   if (activeConversation) {
//     currentScore = await calcConvMaxScore(activeConversation);
//   }

//   // Find the best matching historical conversation (excluding the active one)
//   let bestHistoryMatch = { id: "", title: "", score: -1 };
//   for (const conv of allConversations) {
//     if (activeConversation && conv.id === activeConversation.id) continue;

//     const score = await calcConvMaxScore(conv);
//     if (score > bestHistoryMatch.score) {
//       bestHistoryMatch = { id: conv.id, title: conv.title, score };
//     }
//   }

//   // 3. JavaScript (Fusion Decision)

//   // Scenario A: Recall cue detected and best history match score is above threshold -> Switch to that conversation
//   if (clues.hasRecallCue && bestHistoryMatch.score > 0.25) {
//     return {
//       action: "SWITCH",
//       conversation_id: bestHistoryMatch.id,
//       title: bestHistoryMatch.title,
//       score: bestHistoryMatch.score.toFixed(3),
//       reason: `Rule+Semantic: Recall cue detected with matching topic (${bestHistoryMatch.title}).`,
//     };
//   }

//   // Scenario B: Continuation cue detected and active conversation exists ->
//   // Continue active conversation if score is above threshold or user text is short
//   if (
//     clues.hasContinuationCue &&
//     activeConversation &&
//     (currentScore > 0.2 || userText.split(" ").length <= 5)
//   ) {
//     return {
//       action: "CONTINUE",
//       conversation_id: activeConversation.id,
//       score: currentScore.toFixed(3),
//       reason:
//         "Rule+Semantic: Continuation/pronoun cue refers to active conversation.",
//     };
//   }

//   // Scenario C: Standard semantic matching threshold
//   if (currentScore >= 0.4 && currentScore >= bestHistoryMatch.score) {
//     return {
//       action: "CONTINUE",
//       conversation_id: activeConversation ? activeConversation.id : "",
//       score: currentScore.toFixed(3),
//       reason: "Semantic: High match with current active conversation.",
//     };
//   } else if (bestHistoryMatch.score >= 0.45) {
//     return {
//       action: "SWITCH",
//       conversation_id: bestHistoryMatch.id,
//       title: bestHistoryMatch.title,
//       score: bestHistoryMatch.score.toFixed(3),
//       reason: `Semantic: High match with history conversation (${bestHistoryMatch.title}).`,
//     };
//   }

//   // Scenario D: No strong match found, suggest starting a new conversation
//   return {
//     action: "NEW",
//     conversation_id: "",
//     score: Math.max(currentScore, bestHistoryMatch.score).toFixed(3),
//     reason: "Semantic: Low similarity to all existing conversations.",
//   };
// }

async function routeConversation_Local(
  userText,
  activeConversation,
  allConversations = [],
) {
  if (
    !activeConversation &&
    (!allConversations || allConversations.length === 0)
  ) {
    return {
      action: "NEW",
      conversation_id: "",
      reason: "No conversations exist.",
    };
  }

  const clues = detectContextClues(userText);
  if (clues.hasNewTopicCue) {
    return {
      action: "NEW",
      conversation_id: "",
      reason: "Rule: Explicit new topic request.",
    };
  }

  if (activeConversation) {
    return {
      action: "CONTINUE",
      conversation_id: activeConversation.id,
      reason: "Linear Session: Continuing active conversation.",
    };
  }

  if (allConversations && allConversations.length > 0) {
    const latestConv = allConversations[allConversations.length - 1];
    return {
      action: "CONTINUE",
      conversation_id: latestConv.id,
      reason: "Linear Session: Continuing latest conversation.",
    };
  }

  return {
    action: "NEW",
    conversation_id: "",
    reason: "Fallback: New conversation.",
  };
}

// ==========================================
// 5. Self-Test Function
// ==========================================
async function runSelfTests() {
  await initLocalAI();

  console.log("\n================ [TEST 1: MEMORY INTENT] ================");
  const testQueries = [
    "help me check any scam i received just now? Just to make sure only",
    "then, have i every received any scam? For example most recent one",
    "tadi maybank hantar sms suspicious ah, tolong tengok",
    "good morning baymax, I want to drink tea",
    "is this same scammer from last month?",
  ];

  for (const q of testQueries) {
    console.time("⏱️ Intent Speed");
    const res = await classifyMemoryIntent_Local(q);
    console.timeEnd("⏱️ Intent Speed");
    console.log(
      `Query: "${q}" \n👉 Result: [${res.intent}] (Confidence: ${res.confidence})\n`,
    );
  }

  console.log(
    "================ [TEST 2: CONVERSATION ROUTER] ================",
  );
  const mockActiveConv = {
    id: "CHAT-101",
    title: "Dangerous Scam Message",
    topic: "Scam Messages",
    summary: "User asking about suspicious bank account and SMS.",
  };

  const mockAllConvs = [
    mockActiveConv,
    {
      id: "CHAT-202",
      title: "Grocery Shopping List",
      topic: "Groceries",
      summary: "User discussing buying eggs, milk and vegetables.",
    },
  ];

  const routerQueries = [
    "is that bank account dangerous?", // Should CONTINUE CHAT-101
    "wait, how many eggs did I need to buy again?", // Should SWITCH to CHAT-202
    "can you teach me how to exercise at home?", // Should be NEW
  ];

  for (const q of routerQueries) {
    console.time("⏱️ Router Speed");
    const route = await routeConversation_Local(
      q,
      mockActiveConv,
      mockAllConvs,
    );
    console.timeEnd("⏱️ Router Speed");
    console.log(
      `User: "${q}" \n👉 Route: ${route.action} (Target ID: ${route.conversation_id || "None"}, Score: ${route.score})\n`,
    );
  }
}

module.exports = {
  initLocalAI,
  classifyMemoryIntent_Local,
  routeConversation_Local,
};

if (require.main === module) {
  runSelfTests().catch(console.error);
}
