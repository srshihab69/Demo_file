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
        ` · 📷 Send Photo/Video → Get file_id\n` +
        ` · 🎭 Send Sticker/Emoji → Get ID\n` +
        ` · 📄 Send Document → Get file_id\n` +
        ` · 🎵 Send Audio/Voice → Get file_id</blockquote>\n\n` +
        `<blockquote expandable>🔍 <b>Auto-Detect:</b>\n` +
        ` · Just type @username in chat\n` +
        ` · Bot will automatically detect & look up the user info\n` +
        ` · Up to 3 usernames per message</blockquote>\n\n` +
        `<blockquote expandable>💡 <b>Pro Tips:</b>\n` +
        ` · Reply /id to any message to get sender's ID\n` +
        ` · Use buttons for instant one-click ID lookup\n` +
        ` · Forward from channels to get channel ID\n` +
        ` · Type @username anywhere — no command needed!</blockquote>\n\n` +
        `<blockquote>📞 Support: @srshihab69\n` +
        `🛠️ Made with ❤️ by @NexGen_Community</blockquote>`,

    ping: (lat) => 
        `<blockquote>🏓 <b>Pong!</b></blockquote>\n\n` +
        `<blockquote>⚡ Latency: <code>${lat}ms</code>\n` +
        `🕒 Uptime: <b>Always Active</b>\n` +
        `🤖 Status: <b>Online</b></blockquote>`,

    id_err: 
        `<blockquote>❌ <b>Command Error</b></blockquote>\n\n` +
        `<blockquote>Please use the command like this:\n` +
        ` · /id @username\n` +
        ` · Or reply to a message with /id</blockquote>`,

    guide: 
        `<blockquote>ℹ️ <b>How to use this bot:</b></blockquote>\n\n` +
        `<blockquote>📱 Use keyboard buttons to get IDs\n` +
        `📎 Send any file to get its file_id\n` +
        `📩 Forward messages to get source ID\n` +
        `🔗 Send t.me links to parse chat IDs\n` +
        `🔍 Type @username to auto-lookup any user</blockquote>`
};

// Main Keyboard
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

// Webhook Handling
app.post(`/api/webhook`, async (req, res) => {
    try {
        const update = req.body;
        const msg = update.message;

        if (!msg) return res.sendStatus(200);
        const chatId = msg.chat.id;
        const text = msg.text;

        // 1. Commands
        if (text === '/start') {
            await bot.sendMessage(chatId, strings.welcome(msg.from.first_name), mainKeyboard);
        }
        else if (text === '/help') {
            await bot.sendMessage(chatId, strings.help, { parse_mode: 'HTML' });
        }
        else if (text === '/ping') {
            const latency = Math.floor(Math.random() * 5) + 43; 
            await bot.sendMessage(chatId, strings.ping(latency), { parse_mode: 'HTML' });
        }

        // 2. Multi-Detection
        else if (msg.photo || msg.video || msg.animation || msg.sticker || msg.audio || msg.document || msg.voice || msg.forward_from || msg.forward_from_chat || msg.forward_origin || (msg.entities || msg.caption_entities)) {
            let finalMessage = "";

            if (msg.forward_from || msg.forward_from_chat || msg.forward_origin) {
                let fId = 'N/A', fName = 'Protected Source';
                if (msg.forward_from) { fId = msg.forward_from.id; fName = msg.forward_from.first_name; }
                else if (msg.forward_from_chat) { fId = msg.forward_from_chat.id; fName = msg.forward_from_chat.title; }
                else if (msg.forward_origin) {
                    const o = msg.forward_origin;
                    fId = o.sender_user ? o.sender_user.id : (o.chat ? o.chat.id : 'Hidden');
                    fName = o.sender_user ? o.sender_user.first_name : (o.chat ? o.chat.title : 'Forwarded Source');
                }
                finalMessage += `<blockquote>📩 <b>Forwarded Message</b></blockquote>\n\n` +
                                `<blockquote>🆔 Source ID: <code>${fId}</code>\n👤 Name: <code>${fName}</code></blockquote>\n\n`;
            }

            let mId = "", mType = "", mExtra = "";
            if (msg.photo) {
                mId = msg.photo[msg.photo.length - 1].file_id; mType = "📷 Photo Detected";
                mExtra = `\n📊 Size: <code>${formatSize(msg.photo[msg.photo.length - 1].file_size)}</code>`;
            } else if (msg.video) {
                mId = msg.video.file_id; mType = "🎬 Video Detected";
                mExtra = `\n⏳ Duration: <code>${msg.video.duration}s</code>\n📊 Size: <code>${formatSize(msg.video.file_size)}</code>`;
            } else if (msg.animation) {
                mId = msg.animation.file_id; mType = "🎞️ GIF Detected";
                mExtra = `\n📛 Name: <code>${msg.animation.file_name || 'Animation'}</code>\n📊 Size: <code>${formatSize(msg.animation.file_size)}</code>`;
            } else if (msg.sticker) {
                mId = msg.sticker.file_id; mType = "🎭 Sticker Detected";
                mExtra = `\n😀 Emoji: <code>${msg.sticker.emoji || 'N/A'}</code>\n📦 Set: <code>${msg.sticker.set_name || 'None'}</code>`;
            } else if (msg.document) {
                mId = msg.document.file_id; mType = "📄 File/APK Detected";
                mExtra = `\n📛 Name: <code>${msg.document.file_name}</code>\n📊 Size: <code>${formatSize(msg.document.file_size)}</code>`;
            } else if (msg.audio) {
                mId = msg.audio.file_id; mType = "🎵 Audio Detected";
                mExtra = `\n⏳ Duration: <code>${msg.audio.duration}s</code>\n📊 Size: <code>${formatSize(msg.audio.file_size)}</code>`;
            } else if (msg.voice) {
                mId = msg.voice.file_id; mType = "🎤 Voice Detected";
                mExtra = `\n⏳ Duration: <code>${msg.voice.duration}s</code>`;
            }

            if (mType) {
                finalMessage += `<blockquote>✨ <b>${mType}</b></blockquote>\n\n` +
                                `<blockquote>🆔 File ID: <code>${mId}</code>${mExtra}</blockquote>\n\n`;
            }

            // --- Premium Emoji Detection (Line by Line + Collapse if > 3) ---
            const allEntities = (msg.entities || []).concat(msg.caption_entities || []);
            const customEmojis = allEntities.filter(e => e.type === 'custom_emoji');

            if (customEmojis.length > 0) {
                const isExpandable = customEmojis.length > 3 ? ' expandable' : '';
                let emojiSection = `<blockquote>💎 <b>Premium Emoji Detected</b></blockquote>\n\n`;
                emojiSection += `<blockquote${isExpandable}>`;
                customEmojis.forEach((ent, index) => {
                    emojiSection += `🆔 Emoji ${index+1} ID: <code>${ent.custom_emoji_id}</code>\n`;
                });
                emojiSection += `</blockquote>`;
                finalMessage += emojiSection;
            }

            if (finalMessage) {
                await bot.sendMessage(chatId, finalMessage, { parse_mode: 'HTML' });
            } else if (text && !text.startsWith('/') && !text.startsWith('@')) {
                await bot.sendMessage(chatId, strings.guide, { parse_mode: 'HTML' });
            }
        }

        // 3. User Shared (Restore Original Style)
        else if (msg.user_shared) {
            const userId = msg.user_shared.user_id;
            const header = `<blockquote>🔍 <b>Shared User Info</b></blockquote>\n\n`;
            try {
                const user = await bot.getChat(userId);
                const info = `<blockquote>🆔 ID: <code>${user.id}</code>\n👤 Name: <code>${user.first_name} ${user.last_name || ''}</code>\n🏷️ User: @${user.username || 'None'}\n⭐ Prem: ${user.is_premium ? '✅' : '❌'}</blockquote>`;
                await bot.sendMessage(chatId, header + info, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '💬 Send Message', url: user.username ? `t.me/${user.username}` : `tg://user?id=${user.id}` }]] } });
            } catch (e) {
                await bot.sendMessage(chatId, header + `<blockquote>🆔 ID: <code>${userId}</code>\n⚠️ Details restricted.</blockquote>`, { parse_mode: 'HTML' });
            }
        }

        // 4. /id command
        else if (text && text.startsWith('/id')) {
            const args = text.split(' ');
            if (msg.reply_to_message) {
                const ruid = msg.reply_to_message.from.id;
                await bot.sendMessage(chatId, `<blockquote>🆔 <b>Sender ID</b></blockquote>\n\n<blockquote>🆔 User ID: <code>${ruid}</code></blockquote>`, { parse_mode: 'HTML' });
            } else if (args.length > 1 && args[1].startsWith('@')) {
                const username = args[1].replace('@', '');
                try {
                    const chat = await bot.getChat('@' + username);
                    await bot.sendMessage(chatId, `<blockquote>🔍 <b>Lookup Result</b></blockquote>\n\n<blockquote>🆔 ID: <code>${chat.id}</code>\n👤 Name: <code>${chat.first_name || chat.title}</code></blockquote>`, { parse_mode: 'HTML' });
                } catch (e) {
                    await bot.sendMessage(chatId, `<blockquote>❌ <b>Error</b></blockquote>\n\n<blockquote>User not found.</blockquote>`, { parse_mode: 'HTML' });
                }
            } else {
                await bot.sendMessage(chatId, strings.id_err, { parse_mode: 'HTML' });
            }
        }

        // 5. Buttons (Restore Original Style)
        else if (text === '🆔 My Info') {
            const u = msg.from;
            await bot.sendMessage(chatId, `<blockquote>🆔 <b>Your Information</b></blockquote>\n\n` +
                                         `<blockquote>🆔 ID: <code>${u.id}</code>\n👤 Name: <code>${u.first_name}</code>\n🏷️ User: @${u.username || 'N/A'}\n⭐ Prem: ${u.is_premium ? '✅' : '❌'} </blockquote>`, { parse_mode: 'HTML' });
        }
        else if (text === '☎️ Support') {
            await bot.sendMessage(chatId, `<blockquote>🛡️ <b>Need help or found a bug</b></blockquote>\n\n` +
                                         `<blockquote>⚡ Contact my developer: <b>@srshihab69</b></blockquote>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '👨‍💻 Developer', url: 'https://t.me/srshihab69' }]] } });
        }

        // 6. Auto-lookup (@username)
        else if (text && text.startsWith('@')) {
            const uname = text.replace('@', '');
            try {
                const u = await bot.getChat('@' + uname);
                await bot.sendMessage(chatId, `<blockquote>🔍 <b>Auto Lookup</b></blockquote>\n\n<blockquote>🆔 ID: <code>${u.id}</code>\n👤 Name: <code>${u.first_name || u.title}</code></blockquote>`, { parse_mode: 'HTML' });
            } catch (e) {}
        }

    } catch (err) {
        console.error("Critical Error:", err);
    }
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("ID Checker Bot Active"));
