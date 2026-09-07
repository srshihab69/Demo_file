const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// --- Configuration ---
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

// তোমার দেওয়া MongoDB URI সরাসরি কোডে অ্যাড করা হলো
const mongoUri = "mongodb+srv://srshihab69tg_db_user:I6OHNtnFgeVsrCd6@cluster0.fkxgtiv.mongodb.net/?appName=Cluster0";

const app = express();
app.use(bodyParser.json());

// --- MongoDB Database Connection ---
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Database Connected"))
    .catch(err => console.error("Database Error:", err));

// ইউজার ডাটাবেজ মডেল (বট স্টার্ট করা ইউজারদের মনে রাখার জন্য)
const UserSchema = new mongoose.Schema({
    userId: Number,
    username: String,
    firstName: String
});
const User = mongoose.model('BotUser', UserSchema);

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
        `<blockquote>📞 Support: @srshihab69\n` +
        `🛠️ Made with ❤️ by @NexGen_Community</blockquote>`,

    ping: (lat) => `<blockquote>🏓 <b>Pong!</b></blockquote>\n\n<blockquote>⚡ Latency: <code>${lat}ms</code>\n🤖 Status: <b>Online</b></blockquote>`,

    guide: `<blockquote>ℹ️ <b>How to use:</b></blockquote>\n\n<blockquote>Send @username or any media to get details.</blockquote>`
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
        let isProcessed = false;

        // --- ইউজারের ডাটা সেভ করা (যাতে পরে ইউজারনেম দিয়ে খুঁজে পাওয়া যায়) ---
        if (msg.from && msg.from.username) {
            await User.findOneAndUpdate(
                { userId: msg.from.id },
                { username: msg.from.username.toLowerCase(), firstName: msg.from.first_name },
                { upsert: true }
            );
        }

        // 1. Commands
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

        // 2. My Info & Support
        else if (text === '🆔 My Info') {
            isProcessed = true;
            const u = msg.from;
            await bot.sendMessage(chatId, `<blockquote>🆔 ID: <code>${u.id}</code>\n👤 Name: <code>${u.first_name}</code>\n🏷️ User: @${u.username || 'N/A'}</blockquote>`, { parse_mode: 'HTML' });
        }
        else if (text === '☎️ Support') {
            isProcessed = true;
            await bot.sendMessage(chatId, `⚡ Developer: @srshihab69`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '👨‍💻 Developer', url: 'https://t.me/srshihab69' }]] } });
        }

        // 3. AUTO-LOOKUP (ইউজারনেম ডিটেকশন) - ডাটাবেজ সহ
        const usernameRegex = /@(\w{4,})/g;
        const matches = text.match(usernameRegex);

        if (!isProcessed && matches) {
            isProcessed = true;
            let results = "";
            let inlineButtons = [];

            for (const target of matches.slice(0, 3)) {
                const clean = target.replace('@', '').toLowerCase();
                
                // প্রথমে ডাটাবেজে দেখি সে আগে বট স্টার্ট করেছে কি না
                const dbUser = await User.findOne({ username: clean });

                if (dbUser) {
                    results += `👤 <b>${dbUser.firstName}</b> (User)\n🆔 ID: <code>${dbUser.userId}</code>\n🏷️ User: @${dbUser.username}\n\n`;
                    inlineButtons.push([{ text: `💬 Message ${dbUser.firstName}`, url: `t.me/${dbUser.username}` }]);
                } else {
                    // যদি ডাটাবেজে না থাকে তবে টেলিগ্রামে চ্যানেল/গ্রুপ খুঁজি
                    try {
                        const chat = await bot.getChat('@' + clean);
                        results += `👤 <b>${chat.first_name || chat.title}</b> (${chat.type})\n🆔 ID: <code>${chat.id}</code>\n🏷️ User: @${chat.username}\n\n`;
                        inlineButtons.push([{ text: `🔗 Open ${chat.type}`, url: `t.me/${chat.username}` }]);
                    } catch (e) {
                        results += `⚠️ <b>@${clean}</b>: খুঁজে পাওয়া যায়নি। (ইউজারকে অবশ্যই একবার বট স্টার্ট করতে হবে)।\n\n`;
                    }
                }
            }

            if (results) {
                await bot.sendMessage(chatId, `<blockquote>🔍 <b>Lookup Result</b></blockquote>\n\n${results}`, { 
                    parse_mode: 'HTML', 
                    reply_markup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : null 
                });
            }
        }

        // 4. Media & Forward Detection (সব আগের মতোই আছে)
        if (!isProcessed) {
            let finalInfo = "";
            if (msg.forward_from || msg.forward_from_chat || msg.forward_origin) {
                const fId = msg.forward_from?.id || msg.forward_from_chat?.id || msg.forward_origin?.sender_user?.id || 'Protected';
                finalInfo += `<blockquote>📩 <b>Forward Source ID:</b> <code>${fId}</code></blockquote>\n\n`;
            }
            const media = msg.photo?.[msg.photo.length - 1] || msg.video || msg.document || msg.sticker;
            if (media) {
                finalInfo += `<blockquote>🆔 <b>File ID:</b> <code>${media.file_id}</code>\n📊 Size: <code>${formatSize(media.file_size)}</code></blockquote>`;
            }

            if (finalInfo) {
                await bot.sendMessage(chatId, finalInfo, { parse_mode: 'HTML' });
            } else if (text && !text.startsWith('/') && !text.startsWith('@')) {
                await bot.sendMessage(chatId, strings.guide, { parse_mode: 'HTML' });
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        res.status(200).send('OK');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot Running on Port ${PORT}`));
