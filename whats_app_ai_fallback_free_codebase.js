// === index.js ===
import express from 'express';
import webhookRouter from './services/whatsapp.js';
import planMiddleware from './middleware/plan.js';

const app = express();
app.use(express.json());

// Rate-limit / Plan middleware
app.use(planMiddleware);

// WhatsApp webhook
app.use('/api/webhook', webhookRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// === services/whatsapp.js ===
import express from 'express';
import { getAIResponse } from './ai.js';
import axios from 'axios';
import logger from '../utils/logger.js';

const router = express.Router();

// GET verification
router.get('/', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// POST messages
router.post('/', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messageObject = changes?.value?.messages?.[0];

    if (!messageObject) return res.sendStatus(200);

    const from = messageObject.from;
    const msg = messageObject.text?.body;

    if (!msg) return res.sendStatus(200);

    const reply = await getAIResponse(msg);

    await axios.post(`https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: reply }
      },
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
    );

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ status: 'error' });
  }
});

export default router;

// === services/ai.js ===
import axios from 'axios';
import logger from '../utils/logger.js';

const FREE_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'openrouter/auto'
];

export async function getAIResponse(prompt) {
  for (let model of FREE_MODELS) {
    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model,
        messages: [{ role: 'system', content: 'You are a helpful WhatsApp assistant.' }, { role: 'user', content: prompt }]
      }, {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        timeout: 10000
      });

      return response.data.choices?.[0]?.message?.content || 'AI did not return a message';
    } catch (err) {
      logger.warn(`Model ${model} failed, trying next...`, err.message);
      continue;
    }
  }
  return 'AI service is temporarily unavailable. Try again.';
}

// === middleware/plan.js ===
import logger from '../utils/logger.js';

const userLimits = {};
const FREE_LIMIT = 10; // messages per day

export default function planMiddleware(req, res, next) {
  const userId = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  if (!userId) return next();

  const plan = process.env.USER_PLAN || 'free'; // default free plan

  if (plan === 'free') {
    if (!userLimits[userId]) userLimits[userId] = 0;
    if (userLimits[userId] >= FREE_LIMIT) {
      return res.status(403).json({ status: 'limit_reached', message: 'Free plan limit reached.' });
    }
    userLimits[userId] += 1;
  }
  next();
}

// === utils/logger.js ===
export default {
  log: console.log,
  warn: console.warn,
  error: console.error
};

// === package.json ===
{
  "name": "whatsapp-ai-fallback",
  "version": "1.0.0",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0"
  }
}

// === README.md ===
# WhatsApp AI Auto-Reply Tool

## Setup
1. Clone repository
2. Install dependencies: `npm install`
3. Set environment variables in Vercel:
  - OPENROUTER_API_KEY
  - WHATSAPP_TOKEN
  - VERIFY_TOKEN
  - PHONE_NUMBER_ID
  - USER_PLAN (optional: free/paid)
4. Deploy to Vercel

## Free vs Paid Plans
- Free: 10 messages/day/user
- Paid: Unlimited

## Features
- WhatsApp webhook
- AI response via OpenRouter with free model fallback
- Plan-based message limiting
- Automatic retry on failed AI model calls
