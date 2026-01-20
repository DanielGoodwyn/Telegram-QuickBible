import { bot } from "./bot";

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

    console.log("Starting QuickBible Bot in Polling Mode (Local)...");
    bot.start();
}

run();
