const axios = require('axios');
const { generateAIResponse } = require('./ai');
const { logger } = require('../utils/logger');

class WhatsAppService {
  constructor() {
    this.phoneNumberId = process.env.PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.apiVersion = 'v17.0';
    this.baseURL = `https://graph.facebook.com/${this.apiVersion}`;
  }

  async sendMessage(phoneNumber, message) {
    try {
      const url = `${this.baseURL}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('Message sent successfully:', {
        to: phoneNumber,
        messageId: response.data?.messages?.[0]?.id
      });

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id,
        timestamp: response.data?.messages?.[0]?.timestamp
      };
    } catch (error) {
      logger.error('Error sending WhatsApp message:', {
        error: error.response?.data || error.message,
        phoneNumber,
        message: message.substring(0, 100)
      });

      throw new Error(`Failed to send message: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async processIncomingMessage(messageData) {
    try {
      const entry = messageData.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      
      if (!value || !value.messages) {
        return;
      }

      const message = value.messages[0];
      
      if (message.type === 'text') {
        const phoneNumber = message.from;
        const userMessage = message.text.body;
        
        logger.info('Processing incoming message:', {
          from: phoneNumber,
          message: userMessage
        });

        const aiReply = await generateAIResponse(userMessage, phoneNumber);
        
        if (aiReply) {
          await this.sendMessage(phoneNumber, aiReply);
        }
      }
    } catch (error) {
      logger.error('Error processing incoming message:', error);
    }
  }
}

const whatsappService = new WhatsAppService();

async function handleWebhook(payload) {
  try {
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    
    if (value && value.messages) {
      await whatsappService.processIncomingMessage(payload);
    } else if (value && value.statuses) {
      logger.info('Message status update:', value.statuses[0]);
    }
  } catch (error) {
    logger.error('Error in handleWebhook:', error);
  }
}

async function handleMessages(phoneNumber, message) {
  return await whatsappService.sendMessage(phoneNumber, message);
}

module.exports = {
  WhatsAppService: whatsappService,
  handleWebhook,
  handleMessages,
  sendMessage: whatsappService.sendMessage.bind(whatsappService)
};
