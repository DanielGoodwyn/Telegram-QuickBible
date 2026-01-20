# QuickBible Telegram Bot 📖
<!-- Trigger build for rename -->

A Telegram bot for [QuickBible](https://quickbible.app), built with Node.js and Grammy.
Supports **Serverless Deployment (Vercel)** and **Local Polling**.

## Features
- **Search**: `/search <query>` (Keyword or "Exact Phrase")
- **Random Verse**: `/random`
- **Lookup**: `John 3:16`
- **Schedule**: Posts a random verse every 15 minutes (via GitHub Actions).

## Scheduler (GitHub Actions)
This bot uses **GitHub Actions** to trigger the Vercel cron job every 15 minutes (bypassing Vercel's Hobby Tier limits).
- The workflow is defined in `.github/workflows/schedule.yml`.
- It hits the `/api/cron` endpoint.

## Deployment (Vercel)
This bot is designed to run for **free** on Vercel.

1.  **Fork/Clone** this repo.
2.  **Import to Vercel**.
3.  **Environment Variables**:
    - `BOT_TOKEN`: From @BotFather.
    - `DAILY_CHANNEL_ID`: Channel ID or Username (e.g. `@QuickBible`).
4.  **Set Webhook**:
    - After deployment, set the webhook to your Vercel URL:
    - `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://telegram-quick-bible.vercel.app/api/telegram`

## Local Development
1.  `npm install`
2.  Create `.env` with `BOT_TOKEN`.
3.  `npm run start` (Runs in polling mode).
