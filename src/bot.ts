import { Bot, InlineKeyboard } from "grammy";
import { config } from "dotenv";
import * as cron from "node-cron";
import { bibleService, Verse } from "./services/bibleService";
export { bibleService };

// Load environment variables
config();

if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is not set in .env file");
}

export const bot = new Bot(process.env.BOT_TOKEN);
const DAILY_CHANNEL_ID = process.env.DAILY_CHANNEL_ID;

export const FOOTER = "\n\n@QuickBibleVerseBot";

// --- Helpers ---

function escapeHtml(unsafe: string) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function formatVerse(v: Verse) {
    // Format: <b>Reference</b> \n <blockquote>Text</blockquote>
    const ref = escapeHtml(`${v.book} ${v.chapter}:${v.verse}`);
    const text = escapeHtml(v.text);
    return `<b>${ref}</b>\n<blockquote>${text}</blockquote>${FOOTER}`;
}

export function createVerseKeyboard(book: string, chapter: number, verse: number) {
    const ref = `${book} ${chapter}:${foundVerseNum(verse)}`;
    return new InlineKeyboard()
        .text("📖 Versions", `versions:${ref}`)
        .text("🔗 Cross Refs", `refs:${ref}`)
        .text("🔊 Audio", `audio:${ref}`);
}

function foundVerseNum(verse: any) {
    return typeof verse === 'object' ? verse.verse : verse;
}

async function sendVerse(ctx: any, book: string, chapter: number, verseNum: number) {
    const verse = bibleService.getVerse(book, chapter, verseNum);
    if (verse) {
        return ctx.reply(formatVerse(verse), {
            parse_mode: "HTML",
            reply_markup: createVerseKeyboard(verse.book, verse.chapter, verse.verse)
        });
    }
    return ctx.reply("Verse not found.");
}

// --- Commands ---

bot.command("start", (ctx) => ctx.reply("Welcome to QuickBible! 📖\nUse /help to see available commands."));

bot.command("help", (ctx) => {
    ctx.reply(
        "Available commands:\n" +
        "/start - Start the bot\n" +
        "/help - Show this help message\n" +
        "/search <query> - Search for verses\n" +
        "/random - Get a random verse\n" +
        "/verse <ref> - Get verse text (e.g. /verse John 3:16)\n" +
        "/audio <ref> - Listen to audio (e.g. /audio John 3:16)\n" +
        "/versions <ref> - BibleHub link (e.g. /versions John 3:16)\n" +
        "/references <ref> - See cross references\n" +
        "John 3:16 - Type a reference to get the verse"
    );
});

bot.command("random", (ctx) => {
    const v = bibleService.getRandomVerse();
    ctx.reply(formatVerse(v), {
        parse_mode: "HTML",
        reply_markup: createVerseKeyboard(v.book, v.chapter, v.verse)
    });
});

bot.command("search", (ctx) => {
    const query = ctx.match;
    if (!query) {
        return ctx.reply("Please provide a search query. Example: /search Jesus wept");
    }
    handleSearch(ctx, String(query), 1);
});

bot.command("audio", (ctx) => {
    const query = ctx.match;
    if (!query) return ctx.reply("Usage: /audio John 3:16");
    handleAudio(ctx, String(query));
});

bot.command("versions", (ctx) => {
    const query = ctx.match;
    if (!query) return ctx.reply("Usage: /versions John 3:16");
    handleVersions(ctx, String(query));
});

bot.command("verse", (ctx) => {
    const query = ctx.match;
    if (!query) return ctx.reply("Usage: /verse John 3:16");
    const match = String(query).match(/^(\d?\s?[a-zA-Z]+)\s+(\d+):(\d+)$/);
    if (match) {
        sendVerse(ctx, match[1].trim(), parseInt(match[2]), parseInt(match[3]));
    } else {
        ctx.reply("Invalid format. Use: /verse Book Chapter:Verse");
    }
});

bot.command("references", (ctx) => {
    const query = ctx.match;
    if (!query) return ctx.reply("Usage: /references John 3:16");
    handleReferences(ctx, String(query));
});

// --- Callback Handlers ---

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const colonIndex = data.indexOf(":");
    if (colonIndex === -1) return;

    const action = data.substring(0, colonIndex);
    const rest = data.substring(colonIndex + 1);

    if (action === "versions") {
        await handleVersions(ctx, rest);
    } else if (action === "refs") {
        await handleReferences(ctx, rest);
    } else if (action === "audio") {
        await handleAudio(ctx, rest);
    } else if (action === "search") {
        const parts = rest.split(":");
        const page = parseInt(parts[0]);
        const query = parts.slice(1).join(":");
        await handleSearch(ctx, query, page, true);
    }

    await ctx.answerCallbackQuery();
});

// --- Feature Logic Helpers ---

async function handleSearch(ctx: any, query: string, page: number, isEdit: boolean = false) {
    const results = bibleService.search(query);
    if (results.length === 0) {
        return ctx.reply("No results found.");
    }

    const pageSize = 5;
    const totalPages = Math.ceil(results.length / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageResults = results.slice(start, end);

    const response = pageResults.map(v => {
        const bookCmd = v.book.replace(/ /g, '_');
        const refCmd = `/v_${bookCmd}_${v.chapter}_${v.verse}`;
        const text = escapeHtml(v.text);
        return `<b>${refCmd}</b>\n<blockquote>${text}</blockquote>`;
    }).join("\n\n");

    const header = `🔍 Results for "${query}" (Page ${page}/${totalPages}):\n\n`;
    const fullMessage = header + response + FOOTER;

    const keyboard = new InlineKeyboard();

    // Pagination row
    if (totalPages > 1) {
        // Prev
        if (page > 1) {
            keyboard.text("⬅️ Prev", `search:${page - 1}:${query}`);
        }

        // Page numbers (show current, and maybe 1-2 around it)
        const startPage = Math.max(1, page - 1);
        const endPage = Math.min(totalPages, page + 1);

        for (let i = startPage; i <= endPage; i++) {
            keyboard.text(i === page ? `• ${i} •` : `${i}`, `search:${i}:${query}`);
        }

        // Next
        if (page < totalPages) {
            keyboard.text("Next ➡️", `search:${page + 1}:${query}`);
        }
    }

    if (isEdit) {
        try {
            await ctx.editMessageText(fullMessage, { parse_mode: "HTML", reply_markup: keyboard });
        } catch (e) {
            // Probably same text, ignore
        }
    } else {
        await ctx.reply(fullMessage, { parse_mode: "HTML", reply_markup: keyboard });
    }
}

async function handleVersions(ctx: any, query: string) {
    const match = query.match(/^(\d?\s?[a-zA-Z\s]+)\s+(\d+):(\d+)$/);
    if (!match) return ctx.reply("Invalid reference format.");

    const bookName = match[1].trim();
    const chapter = parseInt(match[2]);
    const verse = parseInt(match[3]);

    const url = bibleService.getBibleHubUrl(bookName, chapter, verse);
    if (!url) {
        return ctx.reply(`Could not generate link for '${bookName}'.`);
    }

    ctx.reply(`📖 Read on BibleHub: ${bookName} ${chapter}:${verse}\n\n${url}${FOOTER}`);
}

async function handleAudio(ctx: any, query: string) {
    const match = query.match(/^(\d?\s?[a-zA-Z\s]+)\s+(\d+)(?::(\d+))?$/);
    if (!match) return ctx.reply("Invalid reference format.");

    const bookName = match[1].trim();
    const chapter = parseInt(match[2]);
    const startVerse = match[3] ? parseInt(match[3]) : 1;

    const bookId = bibleService.getBookId(bookName);
    if (!bookId) return ctx.reply(`Book '${bookName}' not found.`);

    const lastVerse = bibleService.getChapterLastVerse(bookName, chapter);
    if (!lastVerse) return ctx.reply(`Chapter ${chapter} not found in ${bookName}.`);

    const pad = (num: number, size: number) => num.toString().padStart(size, '0');
    const startId = `${pad(bookId, 2)}${pad(chapter, 3)}${pad(startVerse, 3)}`;
    const endId = `${pad(bookId, 2)}${pad(chapter, 3)}${pad(lastVerse, 3)}`;
    const url = `https://audio.esv.org/hw/mq/${startId}-${endId}`;

    ctx.reply(`🎧 Listen to ${bookName} ${chapter}:${startVerse}-${lastVerse}\n\n${url}${FOOTER}`);
}

async function handleReferences(ctx: any, query: string) {
    const match = query.match(/^(\d?\s?[a-zA-Z\s]+)\s+(\d+):(\d+)$/);
    if (!match) return ctx.reply("Invalid format. Use: Book Chapter:Verse");

    const book = match[1].trim();
    const chapter = parseInt(match[2]);
    const verseNum = parseInt(match[3]);

    const refs = bibleService.getCrossReferences(book, chapter, verseNum);
    if (refs.length === 0) return ctx.reply("No cross references found.");

    const buttons = refs.slice(0, 20).map(r => `${r.linkCmd} (${r.display})`).join("\n");
    ctx.reply(`🔗 Cross References for ${book} ${chapter}:${verseNum}:\n\n${buttons}${FOOTER}`);
}

// --- Listeners ---

bot.on("message:text", (ctx) => {
    const text = ctx.message.text;

    // Check for dynamic verse command: /v_Book_Chapter_Verse
    const cmdMatch = text.match(/^\/v_([a-zA-Z0-9_]+)_(\d+)_(\d+)$/);
    if (cmdMatch) {
        const book = cmdMatch[1].replace(/_/g, ' ');
        const chapter = parseInt(cmdMatch[2]);
        const verse = parseInt(cmdMatch[3]);
        sendVerse(ctx, book, chapter, verse);
        return;
    }

    // Typed reference
    const match = text.match(/^(\d?\s?[a-zA-Z]+)\s+(\d+):(\d+)$/);
    if (match) {
        sendVerse(ctx, match[1].trim(), parseInt(match[2]), parseInt(match[3]));
    }
});

// --- Scheduler ---
// Math: 31,102 verses / 365 days / 24 hours = ~3.5 verses/hour = ~Every 17 minutes.
// Setting to every 15 minutes ensures we cover >100% of the count in a year.
cron.schedule("*/15 * * * *", () => {
    if (DAILY_CHANNEL_ID) {
        const v = bibleService.getRandomVerse();
        bot.api.sendMessage(DAILY_CHANNEL_ID, formatVerse(v), {
            parse_mode: "HTML",
            reply_markup: createVerseKeyboard(v.book, v.chapter, v.verse)
        }).catch(err => console.error("Failed to post scheduled verse:", err));
    }
});

bot.catch((err) => {
    console.error("Error in bot:", err);
});

console.log("Starting QuickBible Bot...");

async function run() {
    try {
        await bot.api.setMyCommands([
            { command: "search", description: "Search by keyword or \"phrase\"" },
            { command: "random", description: "Get a random verse" },
            { command: "verse", description: "Get a specific verse text" },
            { command: "audio", description: "Listen to an audio chapter" },
            { command: "versions", description: "Open chapter on BibleHub" },
            { command: "references", description: "Get cross-references" },
            { command: "help", description: "Show available commands" },
        ]);
        console.log("Bot commands set successfully.");
    } catch (e) {
        console.error("Failed to set commands:", e);
    }

    bot.start();
}

run();
