const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

const app = express();
app.use(bodyParser.json());

// --- Helper: Format File Size ---
const formatSize = (bytes) => {
    if (!bytes) return 'N/A';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- Premium Text Data ---
const strings = {
    welcome: (name) => 
        `<blockquote>👋 <b>Hello, ${name}!</b></blockquote>\n\n` +
        `<blockquote>Welcome to <b>Any ID Finder Bot</b>. Use the buttons below to get information about any user or media.</blockquote>`,
    
    help: 
        `<blockquote>🚀 <b>Any ID Finder Bot - Help Menu</b></blockquote>\n\n` +
        `<blockquote expandable>📋 <b>User Commands:</b>\n` +
        ` · /start - Start the bot\n` +
        ` · /help - Show this help menu\n` +
        ` · /id @username - Get ID by username\n` +
        ` · /ping - Check latency & status</blockquote>\n\n` +
        `<blockquote expandable>📱 <b>Keyboard Buttons:</b>\n` +
        ` · 👤 User Info - Get any user's ID\n` +
        ` · 🆔 My Info - Get your own ID details\n` +
        ` · ☎️ Support - Contact developer</blockquote>\n\n` +
        `<blockquote expandable>✨ <b>Special Features:</b>\n` +
        ` · 📩 Forward Msg → Get source & media ID\n` +
        ` · 📷 Send Photo/Video → Get file_id & Res\n` +
        ` · 🎭 Send Sticker/Emoji → Get ID\n` +
        ` · 📄 Send Document → Get file_id\n` +
        ` · 🎵 Send Audio/Voice → Get file_id</blockquote>\n\n` +
        `<blockquote expandable>🔍 <b>Auto-Detect:</b>\n` +
        ` · Just type @username in chat\n` +
        ` · Bot will automatically detect & look up the user info\n` +
        ` · Up to 3 usernames per message</blockquote>\n\n` +
        `<blockquote>📞 Support: @srshihab69\n` +
        `🛠️ Made with ❤️ by @NexGen_Community</blockquote>`,

    ping: (lat) => `<blockquote>🏓 <b>Pong!</b></blockquote>\n\n<blockquote>⚡ Latency: <code>${lat}ms</code>\n🤖 Status: <b>Online</b></blockquote>`,

    id_err: (target) => 
        `<blockquote>❌ <b>Lookup Failed</b></blockquote>\n\n` +
        `<blockquote>Target: <code>${target}</code>\n\n` +
        `⚠️ <b>Possible Reasons:</b>\n` +
        `1. Username is wrong.\n` +
        `2. It's a private user who never started this bot.\n` +
        `3. Telegram restricts bots from searching private users.</blockquote>`,

    guide: `<blockquote>ℹ️ <b>How to use this bot:</b></blockquote>\n\n<blockquote>📱 Use buttons or send @username / media.</blockquote>`
};

const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '👤 User Info', request_users: { request_id: 101, user_is_bot: false } }],
            [{ text: '🆔 My Info' }, { text: '☎️ Support' }]
        ],
        resize_keyboard: true
    },
    parse_mode: 'HTML'
};

// --- Webhook Handling ---
app.post(`/api/webhook`, async (req, res) => {
    try {
        const update = req.body;
        const msg = update.message;
        if (!msg) return res.status(200).send('OK');

        const chatId = msg.chat.id;
        const text = msg.text || msg.caption || "";
        const entities = (msg.entities || []).concat(msg.caption_entities || []);
        let isProcessed = false;

        // 1. Basic Commands
        if (text === '/start') {
            isProcessed = true;
            await bot.sendMessage(chatId, strings.welcome(msg.from.first_name), mainKeyboard);
        }
        else if (text === '/help') {
            isProcessed = true;
            await bot.sendMessage(chatId, strings.help, { parse_mode: 'HTML' });
        }
        else if (text === '/ping') {
            isProcessed = true;
            await bot.sendMessage(chatId, strings.ping(45), { parse_mode: 'HTML' });
        }

        // 2. /id Command
        else if (text.startsWith('/id')) {
            isProcessed = true;
            const args = text.split(' ');
            if (msg.reply_to_message) {
                const ruid = msg.reply_to_message.from.id;
                await bot.sendMessage(chatId, `<blockquote>🆔 <b>User ID:</b> <code>${ruid}</code></blockquote>`, { parse_mode: 'HTML' });
            } else if (args.length > 1) {
                const target = args[1].startsWith('@') ? args[1] : '@' + args[1];
                try {
                    const chat = await bot.getChat(target);
                    await bot.sendMessage(chatId, `<blockquote>🔍 🆔 ID: <code>${chat.id}</code>\n👤 Name: <code>${chat.first_name || chat.title}</code></blockquote>`, { parse_mode: 'HTML' });
                } catch (e) {
                    await bot.sendMessage(chatId, strings.id_err(target), { parse_mode: 'HTML' });
                }
            }
        }

        // 3. Buttons (My Info, Support)
        else if (text === '🆔 My Info') {
            isProcessed = true;
            const u = msg.from;
            await bot.sendMessage(chatId, `<blockquote>🆔 ID: <code>${u.id}</code>\n👤 Name: <code>${u.first_name}</code>\n🏷️ User: @${u.username || 'N/A'}\n⭐ Prem: ${u.is_premium ? '✅' : '❌'} </blockquote>`, { parse_mode: 'HTML' });
        }
        else if (text === '☎️ Support') {
            isProcessed = true;
            await bot.sendMessage(chatId, `<blockquote>⚡ Contact: <b>@srshihab69</b></blockquote>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '👨‍💻 Developer', url: 'https://t.me/srshihab69' }]] } });
        }

        // 4. User Shared via Keyboard
        else if (msg.user_shared) {
            isProcessed = true;
            const userId = msg.user_shared.user_id;
            try {
                const user = await bot.getChat(userId);
                const info = `<blockquote>🔍 Shared ID: <code>${user.id}</code>\n👤 Name: <code>${user.first_name}</code>\n🏷️ User: @${user.username || 'None'}</blockquote>`;
                await bot.sendMessage(chatId, info, { parse_mode: 'HTML' });
            } catch (e) {
                await bot.sendMessage(chatId, `<blockquote>🆔 Shared ID: <code>${userId}</code>\n⚠️ Details hidden by privacy.</blockquote>`, { parse_mode: 'HTML' });
            }
        }

        // 5. Detection (Username, Media, Forward)
        if (!isProcessed) {
            let finalMessage = "";
            let inlineButtons = [];

            // A: Auto-Lookup Username
            const usernameRegex = /@(\w{4,})/g;
            const matches = text.match(usernameRegex) || [];
            
            if (matches.length > 0) {
                isProcessed = true;
                let lookupResults = "";
                for (const target of matches.slice(0, 3)) {
                    try {
                        const chat = await bot.getChat(target);
                        lookupResults += `👤 <b>${chat.first_name || chat.title}</b>\n🆔 ID: <code>${chat.id}</code>\n🏷️ User: ${target}\n\n`;
                        inlineButtons.push([{ text: `Open Profile`, url: `t.me/${chat.username}` }]);
                    } catch (e) {
                        lookupResults += `⚠️ <b>${target}</b>: <i>Not found or private user.</i>\n\n`;
                    }
                }
                if (lookupResults) {
                    await bot.sendMessage(chatId, `<blockquote>🔍 <b>Auto Lookup</b></blockquote>\n\n<blockquote>${lookupResults}</blockquote>`, { 
                        parse_mode: 'HTML', 
                        reply_markup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : null 
                    });
                }
            }

            // B: Forward Message Source
            if (!isProcessed && (msg.forward_from || msg.forward_from_chat || msg.forward_origin)) {
                let fId = 'Hidden';
                if (msg.forward_from) fId = msg.forward_from.id;
                else if (msg.forward_from_chat) fId = msg.forward_from_chat.id;
                else if (msg.forward_origin) fId = msg.forward_origin.sender_user?.id || msg.forward_origin.chat?.id || 'Protected';
                
                finalMessage += `<blockquote>📩 <b>Forward Source ID:</b> <code>${fId}</code></blockquote>\n\n`;
            }

            // C: Media Detection
            const media = msg.photo?.[msg.photo.length - 1] || msg.video || msg.animation || msg.sticker || msg.document || msg.audio || msg.voice;
            if (media) {
                finalMessage += `<blockquote>🆔 <b>File ID:</b> <code>${media.file_id}</code></blockquote>\n`;
                if (media.file_size) finalMessage += `<blockquote>📊 Size: <code>${formatSize(media.file_size)}</code></blockquote>`;
            }

            if (finalMessage) {
                isProcessed = true;
                await bot.sendMessage(chatId, finalMessage, { parse_mode: 'HTML' });
            } 
            else if (text && !text.startsWith('/') && !text.startsWith('@')) {
                await bot.sendMessage(chatId, strings.guide, { parse_mode: 'HTML' });
            }
        }

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        res.status(200).send('OK');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot Active on ${PORT}`));
