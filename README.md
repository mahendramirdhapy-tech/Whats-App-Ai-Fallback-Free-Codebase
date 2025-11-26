# Whats-App-Ai-Fallback-Free-Codebase

A complete backend solution for WhatsApp AI auto-replies using WhatsApp Cloud API and OpenRouter AI.

## Features

- 🤖 AI-powered responses using free OpenRouter models
- 📱 WhatsApp Cloud API integration
- 💰 Plan-based usage limits (Free vs Paid)
- 📊 Comprehensive logging
- 🚀 Ready for Vercel deployment

## Environment Variables

Create a `.env` file or set these in your Vercel project:

```env
# WhatsApp API Configuration
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
PHONE_NUMBER_ID=your_phone_number_id
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# AI Configuration
OPENROUTER_API_KEY=your_openrouter_api_key

# Optional Configuration
LOG_LEVEL=info
PAID_USERS=1234567890,0987654321  # comma-separated phone numbers
