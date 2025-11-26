const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { handleWebhook, handleMessages } = require('./services/whatsapp');
const { verifyPlanAccess } = require('./middleware/plan');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ verify: (req, res, buf) => {
  req.rawBody = buf;
}}));

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ 
    status: 'WhatsApp AI Auto-Reply Backend is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      logger.info('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.error('Webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

app.post('/webhook', verifyPlanAccess, async (req, res) => {
  try {
    logger.info('Received webhook payload:', JSON.stringify(req.body));
    
    if (req.body.object === 'whatsapp_business_account') {
      await handleWebhook(req.body);
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    logger.error('Error in webhook handler:', error);
    res.status(500).send('ERROR_PROCESSING_WEBHOOK');
  }
});

app.post('/send-message', verifyPlanAccess, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'phoneNumber and message are required' });
    }

    const result = await handleMessages(phoneNumber, message);
    res.json(result);
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;
