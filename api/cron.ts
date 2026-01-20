import { bot, formatVerse, createVerseKeyboard, bibleService, FOOTER } from "../src/bot";

export default async function handler(req: any, res: any) {
    // Basic security to ensure only Vercel Cron triggers this (optional but good practice)
    // For simplicity in this demo, we just run the logic.

    const DAILY_CHANNEL_ID = process.env.DAILY_CHANNEL_ID;

    if (!DAILY_CHANNEL_ID) {
        return res.status(500).json({ error: "DAILY_CHANNEL_ID not set" });
    }

    try {
        const v = bibleService.getRandomVerse();
        const kb = createVerseKeyboard(v.book, v.chapter, v.verse, true);
        await bot.api.sendMessage(DAILY_CHANNEL_ID, formatVerse(v), {
            parse_mode: "HTML",
            reply_markup: kb
        });
        return res.status(200).json({ success: true, verse: v, buttons: kb.inline_keyboard });
    } catch (error) {
        console.error("Cron failed:", error);
        return res.status(500).json({ error: "Failed to post verse" });
    }
}
