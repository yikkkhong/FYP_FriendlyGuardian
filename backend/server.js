const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Parsing data in JSON and Form-Data formats sent by SMS Forwarder
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);

// Initialize Socket.IO and enable CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Socket.IO connection event
io.on('connection', (socket) => {
  console.log('⚡ [Socket.IO] React Web Frontend Connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('❌ [Socket.IO] React Web Frontend Disconnected:', socket.id);
  });
});

// Webhook endpoint to receive SMS messages from SMS Forwarder apps
app.post('/api/sms-webhook', (req, res) => {
  console.log('📩 [Webhook Received Body]:', req.body);

  // compatible with the parameter naming formats
  const text = req.body.text || req.body.content || req.body.message || req.body.msg || '';
  const sender = req.body.sender || req.body.from || req.body.phone || 'Unknown Sender';

  console.log(`💬 Message Content: "${text}" from ${sender}`);

  // 1. Named Entity Recognition (NER)
  const accountMatch = text.match(/\d{4,}[-\s]?\d{4,}/);
  const detectedAccount = accountMatch ? accountMatch[0] : '1122-3344-5566';

  // 2. Risk Keyword Detection （Just for Prototype)
  const riskKeywords = [
    'transfer', 'urgent', 'dibekukan', 'acc', 'mule', 
    'scam', 'tolong', 'bank', 'limit', 'prize', 'win'
  ];
  
  const isRisk = riskKeywords.some(keyword => 
    text.toLowerCase().includes(keyword)
  );

  // 3. broadcast alert
  if (isRisk || accountMatch) {
    const alertData = {
      text: text,
      sender: sender,
      detected_account: detectedAccount,
      reason: 'Detected high-risk urgency or mule bank account pattern.',
      timestamp: new Date().toLocaleTimeString(),
    };

    // Broadcast the scam alert to all connected React Web clients
    io.emit('scam_alert', alertData);
    console.log('🚀 [Socket.IO] Scam Alert Broadcasted to React Web!');

    return res.status(200).json({ 
      status: 'success', 
      result: 'alert_triggered', 
      alert: alertData 
    });
  }

  return res.status(200).json({ status: 'success', result: 'safe_message' });
});

// check is server running
app.get('/', (req, res) => {
  res.send('Friendly Guardian Backend Server is Running!');
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Node.js Socket.IO Backend running on http://localhost:${PORT}`);
});