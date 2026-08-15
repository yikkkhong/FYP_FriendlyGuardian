const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

function extractBankAccountRegex(text) {
  if (!text) return null;
  const match = text.match(/\b\d{10,16}\b/) || text.match(/\b\d{3,4}[-\s]?\d{3,4}[-\s]?\d{3,6}\b/);
  return match ? match[0] : null;
}

const RISK_KEYWORDS = ['transfer', 'urgent', 'acc', 'account', 'polis', 'police', 'duti', 'tac', 'otp', 'maybank', 'cimb', 'rhb', 'rhb', 'block', 'suspended'];

function checkRiskKeywords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return RISK_KEYWORDS.some((kw) => lower.includes(kw));
}

async function analyzeSmsWithGemini(messageText, sender) {
  try {
    const prompt = `
      You are Baymax, a protective AI Guardian for elderly users in Malaysia.
      Analyze this intercepted incoming SMS for scam or mule bank account threats:

      SMS Sender: "${sender}"
      SMS Message: "${messageText}"

      Instructions:
      1. Determine if this message is a potential scam or mule account request.
      2. Extract target bank account number if present.
      3. Generate a warm, 1-sentence Baymax advice for an elderly user (gentle Manglish like "don't transfer ah" is encouraged).
      4. Pick suggested_emotion: 'ALERT' (if scam/danger), 'HAPPY' (if safe), or 'NEUTRAL'.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_scam: { type: Type.BOOLEAN },
            detected_account: { type: Type.STRING },
            reason: { type: Type.STRING },
            baymax_message: { type: Type.STRING },
            suggested_emotion: { type: Type.STRING },
          },
          required: ['is_scam', 'detected_account', 'reason', 'baymax_message', 'suggested_emotion'],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error('⚠️ Gemini API Unavailable, Switching to Rule-Engine Fallback...');
    
    // (Fallback Rule-Engine)
    const regexAccount = extractBankAccountRegex(messageText);
    const hasRiskWords = checkRiskKeywords(messageText);
    const isScam = hasRiskWords || !!regexAccount;

    return {
      is_scam: isScam,
      detected_account: regexAccount || '1122-3344-5566',
      reason: isScam ? 'Rule Engine: Detected high-risk keywords or account pattern.' : 'Message appears safe.',
      baymax_message: isScam
        ? 'Oh no! Please do not transfer any money to this account ah!'
        : 'This message looks safe, but always stay cautious!',
      suggested_emotion: isScam ? 'ALERT' : 'HAPPY',
    };
  }
}

async function chatWithBaymax(userText) {
  try {
    const prompt = `
      You are Baymax, a warm, caring AI Guardian companion for elderly users in Malaysia.
      User says: "${userText}"

      Rules:
      1. Maximum 1 or 2 short sentences per response. Never write long paragraphs!
      2. Gentle, simple English with a Malaysian touch (e.g., "don't worry ah", "I am right here with you").
      3. Decide suggested_emotion: 'HAPPY', 'ALERT' (if user is in danger), 'THINKING', or 'NEUTRAL'.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            baymax_message: { type: Type.STRING },
            suggested_emotion: { type: Type.STRING },
          },
          required: ['baymax_message', 'suggested_emotion'],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error('⚠️ Gemini Chat Error, fallback active:', error);
    return {
      baymax_message: 'I am right here with you! Everything is going to be alright.',
      suggested_emotion: 'HAPPY',
    };
  }
}


io.on('connection', (socket) => {
  console.log('⚡ [Socket.IO] React Frontend Connected:', socket.id);

  socket.on('user_chat', async (data) => {
    console.log('💬 [User Chat]:', data.text);
    const aiResponse = await chatWithBaymax(data.text);
    socket.emit('baymax_chat_response', aiResponse);
  });

  socket.on('disconnect', () => {
    console.log('❌ [Socket.IO] Frontend Disconnected');
  });
});


app.post('/api/sms-webhook', async (req, res) => {
  console.log('📩 [SMS Webhook Raw Body]:', req.body);


  const text = req.body.text || req.body.body || req.body.sms_body || req.body.content || req.body.message || '';
  const sender = req.body.sender || req.body.sms_number || req.body.from || req.body.number || 'Unknown Sender';

  if (!text) {
    return res.status(400).json({ status: 'error', message: 'Empty message text' });
  }


  const aiResult = await analyzeSmsWithGemini(text, sender);


  if (!aiResult.detected_account) {
    aiResult.detected_account = extractBankAccountRegex(text) || '1122-3344-5566';
  }

  console.log('🤖 [Final Decision]:', aiResult);

  if (aiResult.is_scam) {
    const alertData = {
      text: text,
      sender: sender,
      detected_account: aiResult.detected_account,
      reason: aiResult.reason,
      baymax_message: aiResult.baymax_message,
      suggested_emotion: aiResult.suggested_emotion || 'ALERT',
      timestamp: new Date().toLocaleTimeString(),
    };

    io.emit('scam_alert', alertData);
  }

  res.status(200).json({ status: 'success', analysis: aiResult });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Hybrid Guardian Server running on http://localhost:${PORT}`);
});