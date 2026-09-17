const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

let botUsername = process.env.BOT_USERNAME || '';
bot.getMe().then(me => {
    if (me && me.username) {
        botUsername = me.username;
        console.log(`Bot Username loaded: @${botUsername}`);
    }
}).catch(err => console.error("Failed to get bot username:", err));

const app = express();
app.use(bodyParser.json());

const mediaStore = new Map();

app.post(`/api/webhook`, async (req, res) => {
    try {
        const update = req.body;

        // 1. Handle Inline Query (When user taps button & list opens)
        if (update.inline_query) {
            const inlineQueryId = update.inline_query.id;
            const queryText = update.inline_query.query || "Selected User";

            // Return an inline result that user can click to send to bot chat
            const results = [{
                type: 'article',
                id: 'user_share_card',
                title: '👤 Send User Info Card',
                description: `Click to send info for: ${queryText}`,
                input_message_content: {
                    message_text: `<blockquote>👤 <b>Shared User Info</b></blockquote>\n` +
                                  `<blockquote>🏷️ Name/Target: <code>${queryText}</code>\n` +
                                  `🆔 Status: <b>Successfully Fetched!</b> ✅</blockquote>`,
                    parse_mode: 'HTML'
                }
            }];

            await bot.answerInlineQuery(inlineQueryId, results, { cache_time: 0 });
            return res.status(200).send('OK');
        }

        // 2. Handle Chosen Inline Result (When user confirms and sends it)
        if (update.chosen_inline_result) {
            const chosen = update.chosen_inline_result;
            const userId = chosen.from.id;
            const queryText = chosen.query;

            // Direct message to user/bot chat if needed
            await bot.sendMessage(userId, 
                `<blockquote>✅ <b>User Data Received Successfully!</b></blockquote>\n` +
                `<blockquote>Target: <code>${queryText}</code>\n` +
                `🆔 Sender ID: <code>${userId}</code></blockquote>`, 
                { parse_mode: 'HTML' }
            );
            return res.status(200).send('OK');
        }

        const msg = update.message;
        if (!msg) return res.status(200).send('OK');

        const chatId = msg.chat.id;
        const text = msg.text || msg.caption || "";

        if (text.startsWith('/start')) {
            await bot.sendMessage(chatId, `<blockquote>👋 <b>Hello! Welcome to TG Meta69 Bot.</b></blockquote>`, {
                parse_mode: 'HTML',
                reply_markup: { remove_keyboard: true }
            });
            return;
        }
        else if (text === '/user') {
            await bot.sendMessage(chatId, 
                `<blockquote>👤 <b>User Info Guide</b></blockquote>\n` +
                `<blockquote>Click the button below to select a user from your chat list and view their info! 🚀</blockquote>`, {
                parse_mode: 'HTML',
                reply_markup: { 
                    inline_keyboard: [
                        [
                            { 
                                text: '👥 Select User from List', 
                                switch_inline_query: '' 
                            }
                        ]
                    ]
                }
            });
        }
        else {
            await bot.sendMessage(chatId, `<blockquote>ℹ️ Use /user to test inline selection.</blockquote>`, { parse_mode: 'HTML' });
        }

    } catch (err) {
        console.error("Critical Error:", err);
    } finally {
        if (!res.headersSent) res.status(200).send('OK');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TG Meta69Bot Active on Port ${PORT}`));
