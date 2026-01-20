# QuickBible Telegram Bot 📖

A Telegram bot for [QuickBible](https://quickbible.app), built with Node.js and Grammy.
Supports **Serverless Deployment (Vercel)** and **Local Polling**.

## Features
- **Search**: `/search <query>` (Keyword or "Exact Phrase")
- **Random Verse**: `/random`
- **Lookup**: `John 3:16`
- **Schedule**: Posts a random verse every 15 minutes (configurable).

## Deployment (Vercel)
This bot is designed to run for **free** on Vercel.

1.  **Fork/Clone** this repo.
2.  **Import to Vercel**.
3.  **Environment Variables**:
    - `BOT_TOKEN`: From @BotFather.
    - `DAILY_CHANNEL_ID`: Channel ID or Username (e.g. `@QuickBible`).
4.  **Set Webhook**:
    - After deployment, set the webhook to your Vercel URL:
    - `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<VERCEL_URL>/api/telegram`

## Local Development
1.  `npm install`
2.  Create `.env` with `BOT_TOKEN`.
3.  `npm run start` (Runs in polling mode).
