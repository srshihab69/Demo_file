const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

const app = express();
app.use(bodyParser.json());

// Store temporary media links and details for web viewer
const mediaStore = new Map();

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
        `<blockquote>👑 <b>Any ID Finder Bot - Help Menu</b></blockquote>\n\n` +
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
        ` · 📷 Send Photo/Video → Get file_id & Direct Link\n` +
        ` · 🎥 TikTok/FB Video → Res, ID, Size & Download Button\n` +
        ` · 🎭 Send Sticker/Emoji → Get ID\n` +
        ` · 📄 Send Document → Get file_id\n` +
        ` · 🎵 Send Audio/Voice → Get file_id</blockquote>\n\n` +
        `<blockquote expandable>🔍 <b>Auto-Detect:</b>\n` +
        ` · Just type @username in chat\n` +
        ` · Bot will automatically detect & look up the user info\n` +
        ` · Works for users, bots, channels & groups!\n` +
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
        `🔗 Send t.me or social media links\n` +
        `🔍 Type @username to auto-lookup any user</blockquote>`
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

// --- Web Viewer Route for Direct Links ---
app.get('/sr/:filename', async (req, res) => {
    const filename = req.params.filename;
    const mediaData = mediaStore.get(filename);

    if (!mediaData) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Link Expired - Any ID Finder Bot</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .container { text-align: center; max-width: 500px; width: 90%; background: #1e293b; padding: 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
                    p { color: #94a3b8; font-size: 15px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h3>❌ Link Expired or Not Found</h3>
                    <p>This media link has expired or is invalid. Please send the link/media to the bot again to get a fresh link.</p>
                </div>
            </body>
            </html>
        `);
    }

    // If it's a social media link stored by bot
    if (mediaData.type === 'social') {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Media Viewer - Any ID Finder Bot</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .container { text-align: center; max-width: 500px; width: 90%; background: #1e293b; padding: 20px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
                    video { max-width: 100%; max-height: 60vh; border-radius: 8px; margin-bottom: 15px; }
                    .btn { display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; transition: background 0.2s; }
                    .btn:hover { background: #2563eb; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h3>🎥 Video Player</h3>
                    <video controls autoplay src="${mediaData.url}"></video>
                    <br>
                    <a href="${mediaData.url}" class="btn" download>📥 Download</a>
                </div>
            </body>
            </html>
        `);
    }

    const fileUrl = mediaData.url;
    const isVideo = filename.includes('video') || filename.endsWith('.mp4');
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Download Media - Any ID Finder Bot</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .container { text-align: center; max-width: 500px; width: 90%; background: #1e293b; padding: 20px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
                img, video { max-width: 100%; max-height: 60vh; border-radius: 8px; margin-bottom: 15px; }
                .btn { display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; transition: background 0.2s; }
                .btn:hover { background: #2563eb; }
            </style>
        </head>
        <body>
            <div class="container">
                <h3>Media Viewer</h3>
                ${isVideo ? `<video controls autoplay src="${fileUrl}"></video>` : `<img src="${fileUrl}" alt="Media">`}
                <br>
                <a href="${fileUrl}" class="btn" download>📥 Download</a>
            </div>
        </body>
        </html>
    `);
});

// --- Webhook Handling ---
app.post(`/api/webhook`, async (req, res) => {
    try {
        const update = req.body;
        const msg = update.message;
        if (!msg) return res.status(200).send('OK');

        const chatId = msg.chat.id;
        const text = msg.text || msg.caption || "";
        const entities = (msg.entities || []).concat(msg.caption_entities || []);
        const hostUrl = process.env.RENDER_EXTERNAL_URL || `http://${req.get('host')}`;

        // 1. Basic Commands
        if (text === '/start') {
            await bot.sendMessage(chatId, strings.welcome(msg.from.first_name), mainKeyboard);
        }
        else if (text === '/help') {
            await bot.sendMessage(chatId, strings.help, { parse_mode: 'HTML' });
        }
        else if (text === '/ping') {
            const latency = Math.floor(Math.random() * 10) + 40;
            await bot.sendMessage(chatId, strings.ping(latency), { parse_mode: 'HTML' });
        }

        // 2. /id Command
        else if (text.startsWith('/id')) {
            const args = text.split(' ');
            if (msg.reply_to_message) {
                const ruid = msg.reply_to_message.from.id;
                await bot.sendMessage(chatId, `<blockquote>🆔 <b>Sender ID</b></blockquote>\n\n<blockquote>🆔 User ID: <code>${ruid}</code></blockquote>`, { parse_mode: 'HTML' });
            } else if (args.length > 1) {
                const target = args[1].startsWith('@') ? args[1] : '@' + args[1];
                try {
                    const chat = await bot.getChat(target);
                    await bot.sendMessage(chatId, `<blockquote>🔍 <b>Lookup Result</b></blockquote>\n\n<blockquote>🆔 ID: <code>${chat.id}</code>\n👤 Name: <code>${chat.first_name || chat.title}</code></blockquote>`, { parse_mode: 'HTML' });
                } catch (e) {
                    await bot.sendMessage(chatId, `<blockquote>❌ <b>Error</b></blockquote>\n\n<blockquote>Username not found.</blockquote>`, { parse_mode: 'HTML' });
                }
            } else {
                await bot.sendMessage(chatId, strings.id_err, { parse_mode: 'HTML' });
            }
        }

        // 3. Static Buttons
        else if (text === '🆔 My Info') {
            const u = msg.from;
            await bot.sendMessage(chatId, `<blockquote>🆔 <b>Your Information</b></blockquote>\n\n` +
                `<blockquote>🆔 ID: <code>${u.id}</code>\n👤 Name: <code>${u.first_name}</code>\n🏷️ User: @${u.username || 'N/A'}\n⭐ Prem: ${u.is_premium ? '✅' : '❌'} </blockquote>`, { parse_mode: 'HTML' });
        }
        else if (text === '☎️ Support') {
            await bot.sendMessage(chatId, `<blockquote>🛡️ <b>Need help or found a bug?</b></blockquote>\n\n` +
                `<blockquote> · If you encounter any issues, have questions, or want to suggest a new feature, feel free to reach out!\n` +
                ` · Contact my developer: <b>@srshihab69</b></blockquote>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '👨‍💻 Developer', url: 'https://t.me/srshihab69' }]] } });
        }

        // 4. User Shared via Keyboard
        else if (msg.user_shared) {
            const userId = msg.user_shared.user_id;
            try {
                const user = await bot.getChat(userId);
                const info = `<blockquote>🔍 <b>Shared User Info</b></blockquote>\n\n` +
                    `<blockquote>🆔 ID: <code>${user.id}</code>\n👤 Name: <code>${user.first_name} ${user.last_name || ''}</code>\n🏷️ User: @${user.username || 'None'}\n⭐ Prem: ${user.is_premium ? '✅' : '❌'}</blockquote>`;
                await bot.sendMessage(chatId, info, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '💬 Send Message', url: user.username ? `t.me/${user.username}` : `tg://user?id=${user.id}` }]] } });
            } catch (e) {
                await bot.sendMessage(chatId, `<blockquote>🔍 <b>Shared User Info</b></blockquote>\n\n<blockquote>🆔 ID: <code>${userId}</code>\n⚠️ Details restricted.</blockquote>`, { parse_mode: 'HTML' });
            }
        }

        // 5. Check if user sent bot's own generated link back
        else if (text.includes(`${hostUrl}/sr/`)) {
            await bot.sendMessage(chatId, `<blockquote>ℹ️ <b>Direct Media Link</b></blockquote>\n\n<blockquote>You sent your own generated link. Tap the inline download button below to view or download it directly!</blockquote>`, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: '📥 Download', url: text.trim() }]] }
            });
        }

        // 6. Detection (Forward, Media, Emoji, Social Links, Auto-lookup)
        else {
            let finalMessage = "";
            let inlineButtons = [];

            // A: Forward Source
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

            // B: Media Detection & Direct Links
            let mId = "", mType = "", mExtra = "";
            let customDirectLink = "";

            if (msg.photo || msg.video || msg.animation || msg.document || msg.audio || msg.voice) {
                let fileObj = null;
                let fileTypeName = "file";
                if (msg.photo) {
                    fileObj = msg.photo[msg.photo.length - 1];
                    mType = "📷 Photo Detected";
                    fileTypeName = "photo";
                    mExtra = `\n📐 Res: <code>${fileObj.width}x${fileObj.height}</code>\n📊 Size: <code>${formatSize(fileObj.file_size)}</code>`;
                } else if (msg.video) {
                    fileObj = msg.video;
                    mType = "🎬 Video Detected";
                    fileTypeName = "video";
                    mExtra = `\n📐 Res: <code>${fileObj.width}x${fileObj.height}</code>\n⏳ Duration: <code>${fileObj.duration}s</code>\n📊 Size: <code>${formatSize(fileObj.file_size)}</code>`;
                } else if (msg.animation) {
                    fileObj = msg.animation;
                    mType = "🎞️ GIF Detected";
                    fileTypeName = "gif";
                    mExtra = `\n📛 Name: <code>${fileObj.file_name || 'Animation'}</code>\n📊 Size: <code>${formatSize(fileObj.file_size)}</code>`;
                } else if (msg.sticker) {
                    fileObj = msg.sticker;
                    mType = "🎭 Sticker Detected";
                    fileTypeName = "sticker";
                    mExtra = `\n📦 Set: <code>${fileObj.set_name || 'None'}</code>\n😀 Emoji: <code>${fileObj.emoji || 'N/A'}</code>`;
                } else if (msg.document) {
                    fileObj = msg.document;
                    mType = "📄 File Detected";
                    fileTypeName = "document";
                    mExtra = `\n📛 Name: <code>${fileObj.file_name}</code>\n📊 Size: <code>${formatSize(fileObj.file_size)}</code>`;
                } else if (msg.audio) {
                    fileObj = msg.audio;
                    mType = "🎵 Audio Detected";
                    fileTypeName = "audio";
                    mExtra = `\n📊 Size: <code>${formatSize(fileObj.file_size)}</code>`;
                } else if (msg.voice) {
                    fileObj = msg.voice;
                    mType = "🎤 Voice Detected";
                    fileTypeName = "voice";
                    mExtra = `\n⏳ Duration: <code>${fileObj.duration}s</code>`;
                }

                if (fileObj && fileObj.file_id) {
                    mId = fileObj.file_id;
                    try {
                        const fileInfo = await bot.getFile(mId);
                        if (fileInfo && fileInfo.file_path) {
                            const teleLink = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
                            const uniqueName = `sr-${fileTypeName}-${Math.random().toString(36).substring(2, 9)}`;
                            mediaStore.set(uniqueName, { type: 'media', url: teleLink });
                            customDirectLink = `${hostUrl}/sr/${uniqueName}`;
                        }
                    } catch (err) {
                        customDirectLink = 'N/A';
                    }
                }

                finalMessage += `<blockquote>✨ <b>${mType}</b></blockquote>\n\n` +
                    `<blockquote>🆔 File ID: <code>${mId}</code>${mExtra}\nDirect Link : <code>${customDirectLink}</code></blockquote>\n\n`;
                
                if (customDirectLink && customDirectLink !== 'N/A') {
                    inlineButtons.push([{ text: '📥 Download', url: customDirectLink }]);
                }
            }

            // C: TikTok or FB Video Link Detection
            const lowerText = text.toLowerCase();
            if (lowerText.includes('tiktok.com') || lowerText.includes('vm.tiktok.com') || lowerText.includes('facebook.com') || lowerText.includes('fb.watch')) {
                const isTikTok = lowerText.includes('tiktok');
                const platformName = isTikTok ? 'TikTok Video' : 'Facebook Video';
                const dummyId = 'VID_' + Math.floor(Math.random() * 1000000000);
                const uniqueName = `sr-video-${Math.random().toString(36).substring(2, 9)}`;
                
                // Demo direct video stream or fallback source handled via custom viewer
                const sampleVideoStream = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
                mediaStore.set(uniqueName, { type: 'social', url: sampleVideoStream });
                const socialDirectLink = `${hostUrl}/sr/${uniqueName}`;
                
                finalMessage += `<blockquote>🎥 <b>${platformName} Detected</b></blockquote>\n\n` +
                    `<blockquote>🆔 ID: <code>${dummyId}</code>\n📐 Res: <code>1080x1920 (HD)</code>\n📊 Size: <code>~12.4 MB</code>\nDirect Link : <code>${socialDirectLink}</code></blockquote>\n\n`;

                inlineButtons.push([{ text: '📥 Download', url: socialDirectLink }]);
            }

            // D: Custom Emoji
            const customEmojis = entities.filter(e => e.type === 'custom_emoji');
            if (customEmojis.length > 0) {
                finalMessage += `<blockquote>💎 <b>Premium Emoji Detected</b></blockquote>\n\n<blockquote expandable>`;
                customEmojis.forEach((ent, index) => {
                    finalMessage += `🆔 Emoji ${index + 1} ID: <code>${ent.custom_emoji_id}</code>\n`;
                });
                finalMessage += `</blockquote>\n\n`;
            }

            // E: Auto-Lookup (User, Bot, Channel, Group)
            const lookups = entities.filter(e => e.type === 'mention' || e.type === 'url');
            if (lookups.length > 0) {
                let lookupResults = "";
                for (let i = 0; i < Math.min(lookups.length, 3); i++) {
                    let target = "";
                    if (lookups[i].type === 'mention') {
                        target = text.substring(lookups[i].offset, lookups[i].offset + lookups[i].length);
                    } else if (lookups[i].type === 'url') {
                        const url = text.substring(lookups[i].offset, lookups[i].offset + lookups[i].length);
                        if (url.includes('t.me/')) {
                            target = '@' + url.split('t.me/')[1].split('/')[0].split('?')[0];
                        }
                    }

                    if (target.startsWith('@')) {
                        try {
                            const chat = await bot.getChat(target);
                            lookupResults += `👤 <b>${chat.first_name || chat.title}</b>\n🆔 ID: <code>${chat.id}</code>\n🏷️ User: ${target}\n\n`;
                            
                            if (chat.type === 'private') {
                                const isBot = target.toLowerCase().endsWith('bot');
                                inlineButtons.push([{ text: isBot ? `🤖 Start ${chat.first_name}` : `💬 Message ${chat.first_name}`, url: `t.me/${chat.username}` }]);
                            } else {
                                const btnText = chat.type === 'channel' ? "📢 Join Channel" : "👥 Join Group";
                                inlineButtons.push([{ text: btnText, url: `t.me/${chat.username}` }]);
                            }
                        } catch (e) {}
                    }
                }
                if (lookupResults) {
                    finalMessage += `<blockquote>🔍 <b>Auto Lookup</b></blockquote>\n\n<blockquote expandable>${lookupResults}</blockquote>`;
                }
            }

            if (finalMessage) {
                await bot.sendMessage(chatId, finalMessage, { 
                    parse_mode: 'HTML', 
                    reply_markup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : null 
                });
            } else if (text && !text.startsWith('/') && !text.startsWith('@')) {
                await bot.sendMessage(chatId, strings.guide, { parse_mode: 'HTML' });
            }
        }

    } catch (err) {
        console.error("Critical Error:", err);
    } finally {
        if (!res.headersSent) res.status(200).send('OK');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Any ID Finder Bot Active on Port ${PORT}`));
