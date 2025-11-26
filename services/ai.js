const axios = require('axios');
const { logger } = require('../utils/logger');

class AIService {
  constructor() {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.conversationHistory = new Map();
    this.MAX_HISTORY_LENGTH = 10;
  }

  getFreeModel() {
    const freeModels = [
      'mistralai/mistral-7b-instruct:free',
      'huggingfaceh4/zephyr-7b-beta:free',
      'google/palm-2-chat-bison:free'
    ];
    
    return freeModels[Math.floor(Math.random() * freeModels.length)];
  }

  async generateResponse(prompt, phoneNumber) {
    try {
      const conversation = this.getConversationHistory(phoneNumber);
      const fullPrompt = this.buildPrompt(prompt, conversation);

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.getFreeModel(),
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant for WhatsApp. Keep responses concise, friendly, and under 1000 characters. Be conversational and helpful.'
            },
            {
              role: 'user',
              content: fullPrompt
            }
          ],
          max_tokens: 300,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://your-domain.com',
            'X-Title': 'WhatsApp AI Assistant'
          },
          timeout: 10000
        }
      );

      const aiReply = response.data.choices[0].message.content.trim();
      
      this.updateConversationHistory(phoneNumber, prompt, aiReply);
      
      logger.info('AI response generated successfully:', {
        phoneNumber,
        promptLength: prompt.length,
        replyLength: aiReply.length,
        model: response.data.model
      });

      return aiReply;
    } catch (error) {
      logger.error('Error generating AI response:', {
        error: error.response?.data || error.message,
        phoneNumber
      });

      return this.getFallbackResponse(prompt);
    }
  }

  getConversationHistory(phoneNumber) {
    return this.conversationHistory.get(phoneNumber) || [];
  }

  updateConversationHistory(phoneNumber, userMessage, aiReply) {
    let history = this.conversationHistory.get(phoneNumber) || [];
    
    history.push({ role: 'user', content: userMessage });
    history.push({ role: 'assistant', content: aiReply });
    
    if (history.length > this.MAX_HISTORY_LENGTH * 2) {
      history = history.slice(-this.MAX_HISTORY_LENGTH * 2);
    }
    
    this.conversationHistory.set(phoneNumber, history);
  }

  buildPrompt(currentPrompt, history) {
    if (history.length === 0) {
      return currentPrompt;
    }

    let context = 'Previous conversation:\n';
    history.forEach((entry, index) => {
      const role = entry.role === 'user' ? 'User' : 'Assistant';
      context += `${role}: ${entry.content}\n`;
    });
    
    context += `\nCurrent message: ${currentPrompt}`;
    return context;
  }

  getFallbackResponse(prompt) {
    const fallbackResponses = [
      "I'm currently experiencing high load. Please try again in a moment!",
      "Thanks for your message! I'll get back to you shortly.",
      "I'm here to help! Could you rephrase your question?",
      "I appreciate your message. Let me think about that...",
      "Hello! I'm your AI assistant. How can I help you today?"
    ];
    
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }

  clearHistory(phoneNumber) {
    this.conversationHistory.delete(phoneNumber);
  }
}

const aiService = new AIService();

async function generateAIResponse(prompt, phoneNumber) {
  return await aiService.generateResponse(prompt, phoneNumber);
}

module.exports = {
  AIService: aiService,
  generateAIResponse
};
