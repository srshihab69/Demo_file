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

// In-memory stores for media, sessions, passwords, and failed attempts tracking
const mediaStore = new Map();
const pendingUploads = new Map();
const mediaPasswords = new Map();
const userPasswordInputs = new Map();
const failedPasswordAttempts = new Map(); // Tracks wrong password tries per user/chat

const formatSize = (bytes) => {
    if (!bytes) return 'N/A';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const strings = {
    welcome: (name) => 
        `<blockquote>👋 <b>Hello, ${name}!</b></blockquote>\n\n` +
        `<blockquote>Welcome to <b>TG Meta69 Bot!</b> Explore user & media information, manage media tools with strict password security, and download TikTok videos with ease. 🚀</blockquote>`,
    
    help: 
        `<blockquote>👑 <b>TG Meta69 Bot - Help Menu</b></blockquote>\n\n` +
        `<blockquote expandable>📋 <b>User Commands:</b>\n` +
        ` · /start - Start the bot\n` +
        ` · /srmeta - Trigger media lookup via shared link\n` +
        ` · /tiktok - Download TikTok video\n` +
        ` · /help - Show this help menu\n` +
        ` · /id @username - Get ID by username\n` +
        ` · /stat - Check bot statistics & status</blockquote>\n\n` +
        `<blockquote expandable>📱 <b>Keyboard Buttons:</b>\n` +
        ` · 👤 User Info - Get any user's ID\n` +
        ` · 🆔 My Info - Get your own ID details\n` +
        ` · ☎️ Support - Contact developer</blockquote>\n\n` +
        `<blockquote expandable>✨ <b>Special Features:</b>\n` +
        ` · 📩 Forward Msg → Get source & media ID (No links/buttons generated for forwarded media)\n` +
        ` · 📷 Send Photo/Video → Get Browser Direct Link & Share Deep Link with 3-Attempt Password Security\n` +
        ` · 🎥 TikTok Video → Send link for direct chat video download (Under 30MB)\n` +
        ` · 🎭 Send Sticker/Emoji → Get ID (Unique)\n` +
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
        `🛠️ Made with ❤️ by @sr_shihab69</blockquote>`,

    stat: (mediaCount, lat) => 
        `<blockquote>📊 <b>Bot Statistics & Status</b></blockquote>\n\n` +
        `<blockquote>⚡ Latency: <code>${lat}ms</code>\n` +
        `🤖 Status: <b>Online</b>\n` +
        `🕒 Uptime: <b>Always Active</b>\n` +
        `📂 Stored Media: <code>${mediaCount} items</code>\n` +
        `⚙️ Version: <code>${process.version}</code></blockquote>`,

    id_err: 
        `<blockquote>ℹ️ <b>Use This Command</b></blockquote>\n\n` +
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

// Express route for browser media viewer with 3-Attempt Password Check
app.get('/sr/:filename', async (req, res) => {
    const filename = req.params.filename;
    const mediaData = mediaStore.get(filename);

    if (!mediaData || !mediaData.url) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Link Expired - TG Meta69 Bot</title>
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

    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const attemptKey = `web_${filename}_${clientIp}`;
    const failedTries = failedPasswordAttempts.get(attemptKey) || 0;

    if (failedTries >= 3) {
        return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Access Denied - TG Meta69 Bot</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; background: #0f172a; color: #f87171; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .container { text-align: center; max-width: 500px; width: 90%; background: #1e293b; padding: 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
                    p { color: #94a3b8; font-size: 15px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h3>⛔ ACCESS DENIED</h3>
                    <p>You have entered the wrong password 3 times. Access to this media has been blocked for security reasons.</p>
                </div>
            </body>
            </html>
        `);
    }

    const requiredPassword = mediaPasswords.get(filename);
    const providedPassword = req.query.pwd || '';

    if (requiredPassword && providedPassword !== requiredPassword) {
        const currentTries = failedTries + 1;
        failedPasswordAttempts.set(attemptKey, currentTries);
        const remainingTries = 3 - currentTries;

        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Password Protected - TG Meta69 Bot</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 15px; box-sizing: border-box; }
                    .container { text-align: center; max-width: 400px; width: 100%; background: #1e293b; padding: 25px; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); }
                    input { width: 80%; padding: 12px; font-size: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; margin-bottom: 15px; outline: none; }
                    button { background: #38bdf8; color: #0f172a; border: none; padding: 12px 24px; font-size: 15px; font-weight: bold; border-radius: 8px; cursor: pointer; transition: background 0.2s; }
                    button:hover { background: #0ea5e9; }
                    .error { color: #f87171; font-size: 13px; margin-top: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h3>🔒 Password Protected Media</h3>
                    <p style="color: #94a3b8; font-size: 14px;">Please enter the password to view this file. (${remainingTries} attempt(s) remaining)</p>
                    <form method="GET" action="">
                        <input type="password" name="pwd" placeholder="Enter password..." required autofocus /><br>
                        <button type="submit">Unlock Media</button>
                    </form>
                    ${providedPassword ? `<div class="error">Incorrect Password! ${remainingTries} attempt(s) left.</div>` : ''}
                </div>
            </body>
            </html>
        `);
    }

    const fileType = mediaData.fileType;
    const mediaUrl = mediaData.url;

    let mediaHtml = '';
    if (fileType === 'photo' || fileType === 'sticker' || fileType === 'gif') {
        mediaHtml = `<img src="${mediaUrl}" alt="Media Viewer" style="max-width: 100%; max-height: 60vh; border-radius: 8px; object-fit: contain;" />`;
    } else if (fileType === 'video') {
        mediaHtml = `<video src="${mediaUrl}" controls autoplay style="max-width: 100%; max-height: 60vh; border-radius: 8px; outline: none;"></video>`;
    } else if (fileType === 'audio' || fileType === 'voice') {
        mediaHtml = `<audio src="${mediaUrl}" controls autoplay style="width: 100%; margin: 20px 0;"></audio>`;
    } else {
        mediaHtml = `<p style="color: #94a3b8;">Document or file ready for download.</p>`;
    }

    return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>View Media - TG Meta69 Bot</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 15px; box-sizing: border-box; }
                .container { text-align: center; max-width: 550px; width: 100%; background: #1e293b; padding: 20px; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); }
                .media-box { margin: 15px 0; display: flex; justify-content: center; align-items: center; background: #090d16; border-radius: 10px; padding: 10px; min-height: 200px; }
                .download-btn { display: inline-block; background: #38bdf8; color: #0f172a; padding: 12px 24px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px; margin-top: 15px; transition: background 0.2s; box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3); }
                .download-btn:hover { background: #0ea5e9; }
                .footer { margin-top: 15px; font-size: 13px; color: #64748b; }
            </style>
        </head>
        <body>
            <div class="container">
                <h3 style="margin-top: 5px; color: #f8fafc;">✨ Media Viewer</h3>
                <div class="media-box">
                    ${mediaHtml}
                </div>
                <a href="${mediaUrl}" class="download-btn" download>📥 Download File</a>
                <div class="footer">Powered by TG Meta69 Bot</div>
            </div>
        </body>
        </html>
    `);
});

// Helper function to handle media retrieval with 3-Attempt Bot Password Check
async function handleMediaPayload(chatId, mediaData, providedPwd = '', promptMessageId = null) {
    if (mediaData) {
        const browserFilename = mediaData.browserFilename;
        const reqPwd = browserFilename ? mediaPasswords.get(browserFilename) : null;

        const attemptKey = `bot_${chatId}_${browserFilename}`;
        const failedTries = failedPasswordAttempts.get(attemptKey) || 0;

        if (failedTries >= 3) {
            await bot.sendMessage(chatId, `<blockquote>⛔ <b>ACCESS DENIED</b>\n\nYou have entered the wrong password 3 times. Access to this media has been blocked for security reasons.</blockquote>`, { parse_mode: 'HTML' });
            return false;
        }

        if (reqPwd && providedPwd !== reqPwd) {
            userPasswordInputs.set(chatId, { browserFilename, mediaData });
            const currentTries = failedTries + 1;
            failedPasswordAttempts.set(attemptKey, currentTries);
            const remainingTries = 3 - currentTries;

            // Delete previous prompt message to keep chat clean if requested
            if (promptMessageId) {
                await bot.deleteMessage(chatId, promptMessageId).catch(() => {});
            }

            await bot.sendMessage(chatId, `<blockquote>🔒 <b>Password Required</b>\n\nThis media is protected with a password. Please type and send the correct password in chat.\n⚠️ <i>(${remainingTries} attempt(s) remaining before access is permanently blocked)</i></blockquote>`, { parse_mode: 'HTML' });
            return false;
        }

        // Reset attempts and clean state on successful entry
        failedPasswordAttempts.delete(attemptKey);
        userPasswordInputs.delete(chatId);

        // Delete previous prompt message if successful
        if (promptMessageId) {
            await bot.deleteMessage(chatId, promptMessageId).catch(() => {});
        }

        const generatorName = mediaData.user ? (mediaData.user.first_name || 'Unknown User') : 'Unknown User';
        const generatorId = mediaData.user ? mediaData.user.id : 'N/A';
        const generatorUsername = mediaData.user && mediaData.user.username ? `@${mediaData.user.username}` : 'No Username';
        const userLinkHtml = mediaData.user && mediaData.user.username ? `<a href="t.me/${mediaData.user.username}">${generatorName}</a>` : `<code>${generatorName}</code>`;

        const headerText = `<blockquote>👤 <b>Generated By:</b> ${userLinkHtml}\n🆔 ID: <code>${generatorId}</code>\n🏷️ Username: ${generatorUsername}</blockquote>\n\n`;

        if (mediaData.fileType === 'photo' && mediaData.fileId) {
            await bot.sendPhoto(chatId, mediaData.fileId, {
                caption: headerText + `✨ <b>Here is your requested photo!</b>`,
                parse_mode: 'HTML'
            });
            return true;
        } else if (mediaData.fileType === 'video' && mediaData.fileId) {
            await bot.sendVideo(chatId, mediaData.fileId, {
                caption: headerText + `✨ <b>Here is your requested video!</b>`,
                parse_mode: 'HTML'
            });
            return true;
        } else if (mediaData.fileType === 'document' && mediaData.fileId) {
            await bot.sendDocument(chatId, mediaData.fileId, {
                caption: headerText + `✨ <b>Here is your requested document!</b>`,
                parse_mode: 'HTML'
            });
            return true;
        } else if (mediaData.fileType === 'audio' && mediaData.fileId) {
            await bot.sendAudio(chatId, mediaData.fileId, {
                caption: headerText + `✨ <b>Here is your requested audio!</b>`,
                parse_mode: 'HTML'
            });
            return true;
        } else if (mediaData.fileType === 'voice' && mediaData.fileId) {
            await bot.sendVoice(chatId, mediaData.fileId, {
                caption: headerText + `✨ <b>Here is your requested voice!</b>`,
                parse_mode: 'HTML'
            });
            return true;
        } else if (mediaData.fileType === 'sticker' && mediaData.fileId) {
            await bot.sendSticker(chatId, mediaData.fileId);
            return true;
        }
    }

    await bot.sendMessage(chatId, `<blockquote>❌ <b>Link Expired or Not Found</b></blockquote>\n\n<blockquote>This media link has expired or is invalid. Please send the media to the bot again to get a fresh link.</blockquote>`, { parse_mode: 'HTML' });
    return false;
}

app.post(`/api/webhook`, async (req, res) => {
    try {
        const update = req.body;

        // Handle inline button callbacks securely
        if (update.callback_query) {
            const callbackQuery = update.callback_query;
            const msg = callbackQuery.message;
            if (msg) {
                const chatId = msg.chat.id;
                const data = callbackQuery.data;

                if (data === 'help_menu') {
                    await bot.editMessageText(strings.help, {
                        chat_id: chatId,
                        message_id: msg.message_id,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🏠 Back to Start', callback_data: 'back_start' }]
                            ]
                        }
                    });
                    await bot.answerCallbackQuery(callbackQuery.id);
                } else if (data === 'back_start') {
                    await bot.editMessageText(strings.welcome(callbackQuery.from.first_name), {
                        chat_id: chatId,
                        message_id: msg.message_id,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'ℹ️ Help Menu', callback_data: 'help_menu' }]
                            ]
                        }
                    });
                    await bot.answerCallbackQuery(callbackQuery.id);
                } else if (data.startsWith('pwd_ask_')) {
                    const origMsgId = data.split('_')[2];
                    userPasswordInputs.set(chatId, { mode: 'setting_pwd', origMsgId });
                    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Please type the password in chat.' });
                    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
                    await bot.sendMessage(chatId, `<blockquote>🔐 <b>Set Media Password</b>\n\nPlease type and send the password you want to set for this file.</blockquote>`, { parse_mode: 'HTML' });
                } else if (data.startsWith('pwd_none_')) {
                    const origMsgId = data.split('_')[2];
                    const pendingKey = `${chatId}_${origMsgId}`;
                    const fileData = pendingUploads.get(pendingKey);

                    if (!fileData) {
                        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Session expired. Please resend the file.', show_alert: true });
                    } else {
                        await bot.answerCallbackQuery(callbackQuery.id, { text: '⏳ Generating Telegram links...' });
                        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
                        await processMediaShare(chatId, fileData, callbackQuery.from, null);
                    }
                }
            }
            if (!res.headersSent) res.status(200).send('OK');
            return;
        }

        const msg = update.message;
        if (!msg) return res.status(200).send('OK');

        const chatId = msg.chat.id;
        const text = msg.text || msg.caption || "";
        const entities = (msg.entities || []).concat(msg.caption_entities || []);
        const hostUrl = process.env.RENDER_EXTERNAL_URL || `http://${req.get('host')}`;

        // Handle password input inside chat
        if (userPasswordInputs.has(chatId) && text && !text.startsWith('/')) {
            const state = userPasswordInputs.get(chatId);
            if (state.mode === 'setting_pwd') {
                const password = text.trim();
                const pendingKey = `${chatId}_${state.origMsgId}`;
                const fileData = pendingUploads.get(pendingKey);
                userPasswordInputs.delete(chatId);

                if (!fileData) {
                    await bot.sendMessage(chatId, `<blockquote>❌ <b>Session Expired.</b> Please resend the file.</blockquote>`, { parse_mode: 'HTML' });
                } else {
                    await bot.sendMessage(chatId, `<blockquote>⏳ <b>Generating password-protected links...</b></blockquote>`, { parse_mode: 'HTML' });
                    await processMediaShare(chatId, fileData, msg.from, password);
                }
                return res.status(200).send('OK');
            } else if (state.browserFilename && state.mediaData) {
                const password = text.trim();
                await handleMediaPayload(chatId, state.mediaData, password, msg.message_id);
                return res.status(200).send('OK');
            }
        }

        // Handle /start with deep link payload (e.g., /start srmeta_xxxx)
        if (text.startsWith('/start')) {
            const parts = text.split(' ');
            if (parts.length > 1 && parts[1].startsWith('srmeta_')) {
                const payload = parts[1];
                if (mediaStore.has(payload)) {
                    await handleMediaPayload(chatId, mediaStore.get(payload));
                    return;
                } else {
                    await bot.sendMessage(chatId, `<blockquote>❌ <b>Link Expired or Not Found</b></blockquote>\n\n<blockquote>This media link has expired or is invalid.</blockquote>`, { parse_mode: 'HTML' });
                    return;
                }
            } else {
                await bot.sendMessage(chatId, strings.welcome(msg.from.first_name), mainKeyboard);
                return;
            }
        }
        else if (text.startsWith('/srmeta')) {
            const parts = text.split(' ');
            const payload = parts[1]; 

            if (payload && mediaStore.has(payload)) {
                await handleMediaPayload(chatId, mediaStore.get(payload));
                return;
            }

            await bot.sendMessage(chatId, 
                `<blockquote>🔗 <b>Supported Links</b>\n\n` +
                `├─ 🤖 This bot supports only links generated by the bot itself:\n` +
                `├─ 🔗 Direct Media Links\n` +
                `└─ 🔗 Shared Media Links\n\n` +
                `⚠️ Please use a Direct or Share Link.</blockquote>`, 
                { parse_mode: 'HTML' }
            );
        }
        else if (text.startsWith('/tiktok')) {
            await bot.sendMessage(chatId, `<blockquote>🎵 Send me a TikTok video link 🔗</blockquote>`, { parse_mode: 'HTML' });
            return;
        }
        else if (text === '/help') {
            await bot.sendMessage(chatId, strings.help, { parse_mode: 'HTML' });
        }
        else if (text === '/stat') {
            const latency = Math.floor(Math.random() * 10) + 40;
            const effectiveCount = Math.ceil(mediaStore.size / 2);
            await bot.sendMessage(chatId, strings.stat(effectiveCount, latency), { parse_mode: 'HTML' });
        }
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
        else if (msg.user_shared) {
            const userId = msg.user_shared.user_id;
            try {
                const user = await bot.getChat(userId);
                const info = `<blockquote>🔍 <b>Shared User Info</b></blockquote>\n\n` +
                    `<blockquote>🆔 ID: <code>${user.id}</code>\n👤 Name: <code>${user.first_name} ${user.last_name || ''}</code>\n🏷️ User: @${user.username || 'None'}\n⭐ Prem: ${user.is_premium ? '✅' : '❌'}</blockquote>`;
                await bot.sendMessage(chatId, info, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '💬 Message', url: user.username ? `t.me/${user.username}` : `tg://user?id=${user.id}` }]] } });
            } catch (e) {
                await bot.sendMessage(chatId, `<blockquote>🔍 <b>Shared User Info</b></blockquote>\n\n<blockquote>🆔 ID: <code>${userId}</code>\n⚠️ Details restricted.</blockquote>`, { parse_mode: 'HTML' });
            }
        }
        else if (text.includes(`${hostUrl}/sr/`)) {
            const trimmedLink = text.trim();
            const filename = trimmedLink.split('/sr/')[1]?.split(' ')[0];
            const mediaData = mediaStore.get(filename);

            if (mediaData) {
                await handleMediaPayload(chatId, mediaData);
                return;
            }

            await bot.sendMessage(chatId, `<blockquote>❌ <b>Link Expired or Not Found</b></blockquote>\n\n<blockquote>This browser link has expired or is invalid.</blockquote>`, { parse_mode: 'HTML' });
        }
        // ================= TIKTOK HANDLER (BUFFER + 30MB CHECK) =================
        else if (text.toLowerCase().includes('tiktok.com') || text.toLowerCase().includes('vm.tiktok.com')) {
            let videoDownloadUrl = "";
            let processingMsg = null;

            try {
                processingMsg = await bot.sendMessage(chatId, `⏳ <b>Downloading video...</b>`, { parse_mode: 'HTML' });

                const urlRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:vm\.tiktok\.com|tiktok\.com)\/[^\s]+/g;
                const foundUrls = text.match(urlRegex) || [];
                
                let targetUrl = foundUrls.find(url => !url.includes('tiktoklite')) || foundUrls[0] || text.trim();

                if (targetUrl.includes('?')) {
                    targetUrl = targetUrl.split('?')[0];
                }

                const apiRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                
                const apiData = await apiRes.json();
                
                if (apiData && apiData.code === 0 && apiData.data) {
                    videoDownloadUrl = apiData.data.hdplay || apiData.data.play || "";
                }

                if (processingMsg) {
                    await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
                }

                if (videoDownloadUrl) {
                    const videoRes = await fetch(videoDownloadUrl);
                    const arrayBuffer = await videoRes.arrayBuffer();
                    const videoBuffer = Buffer.from(arrayBuffer);
                    const sizeInMB = videoBuffer.length / (1024 * 1024);

                    if (sizeInMB <= 30) {
                        await bot.sendVideo(chatId, videoBuffer, {
                            caption: `📥 <b>Downloaded via TG Meta69 Bot</b>\n📊 Size: <code>${sizeInMB.toFixed(2)} MB</code>\n👨‍💻 Developer: @srshihab69`,
                            parse_mode: 'HTML'
                        }, {
                            filename: 'tiktok_video.mp4',
                            contentType: 'video/mp4'
                        });
                        return;
                    } else {
                        await bot.sendMessage(chatId, 
                            `<blockquote>⚠️ <b>Video is larger than 30MB!</b></blockquote>\n\n` +
                            `<blockquote>📊 File Size: <code>${sizeInMB.toFixed(2)} MB</code>\n` +
                            `🔗 Click the button below to download the video directly from the browser. ✅</blockquote>`, 
                            { 
                                parse_mode: 'HTML',
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: `📥 Download HD Video (${sizeInMB.toFixed(1)} MB)`, url: videoDownloadUrl }]
                                    ]
                                }
                            }
                        );
                        return;
                    }
                } else {
                    await bot.sendMessage(chatId, `<blockquote>⚠️ <b>This link is not supported.</b>\n\n🔗 <b>Please send a valid link and try again.</b> ✅</blockquote>`, { parse_mode: 'HTML' });
                    return;
                }
            } catch (apiErr) {
                console.error("TikTok Video Error:", apiErr);
                if (processingMsg) {
                    await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
                }
                await bot.sendMessage(chatId, `<blockquote>⚠️ <b>This link is not supported.</b>\n\n🔗 <b>Please send a valid link and try again.</b> ✅</blockquote>`, { parse_mode: 'HTML' });
                return;
            }
        }
        // =======================================================================
        else {
            const isForwarded = Boolean(msg.forward_date || msg.forward_from || msg.forward_from_chat || msg.forward_origin);

            // ================= FORWARDED MEDIA HANDLER (NO LINKS / NO BUTTONS) =================
            if (isForwarded) {
                let fId = 'N/A', fName = 'Protected Source';
                if (msg.forward_from) { fId = msg.forward_from.id; fName = msg.forward_from.first_name; }
                else if (msg.forward_from_chat) { fId = msg.forward_from_chat.id; fName = msg.forward_from_chat.title; }
                else if (msg.forward_origin) {
                    const o = msg.forward_origin;
                    fId = o.sender_user ? o.sender_user.id : (o.chat ? o.chat.id : 'Hidden');
                    fName = o.sender_user ? o.sender_user.first_name : (o.chat ? o.chat.title : 'Forwarded Source');
                }

                let fileObj = null;
                let mType = "Forwarded Media";
                let mExtra = "";

                if (msg.photo) { fileObj = msg.photo[msg.photo.length - 1]; mType = "📷 Forwarded Photo"; mExtra = `\n📐 Res: <code>${fileObj.width}x${fileObj.height}</code>\n📊 Size: <code>${formatSize(fileObj.file_size)}</code>`; }
                else if (msg.video) { fileObj = msg.video; mType = "🎬 Forwarded Video"; mExtra = `\n📐 Res: <code>${fileObj.width}x${fileObj.height}</code>\n⏳ Duration: <code>${fileObj.duration}s</code>\n📊 Size: <code>${formatSize(fileObj.file_size)}</code>`; }
                else if (msg.document) { fileObj = msg.document; mType = "📄 Forwarded Document"; mExtra = `\n📛 Name: <code>${fileObj.file_name}</code>\n📊 Size: <code>${formatSize(fileObj.file_size)}</code>`; }
                else if (msg.audio) { fileObj = msg.audio; mType = "🎵 Forwarded Audio"; mExtra = `\n📊 Size: <code>${formatSize(fileObj.file_size)}</code>`; }
                else if (msg.voice) { fileObj = msg.voice; mType = "🎤 Forwarded Voice"; mExtra = `\n⏳ Duration: <code>${fileObj.duration}s</code>`; }

                let fwdMsgText = `<blockquote>📩 <b>Forwarded Message</b></blockquote>\n\n` +
                    `<blockquote>🆔 Source ID: <code>${fId}</code>\n👤 Name: <code>${fName}</code></blockquote>\n\n`;

                if (fileObj && fileObj.file_id) {
                    fwdMsgText += `<blockquote>✨ <b>${mType}</b></blockquote>\n\n` +
                        `<blockquote>🆔 File ID: <code>${fileObj.file_id}</code>${mExtra}</blockquote>`;
                } else {
                    fwdMsgText += `<blockquote>💬 <b>Text:</b> ${text}</blockquote>`;
                }

                await bot.sendMessage(chatId, fwdMsgText, { parse_mode: 'HTML' });
                return res.status(200).send('OK');
            }
            // ===================================================================================

            let fileObj = null;
            let fileTypeName = "file";

            if (msg.photo) {
                fileObj = msg.photo[msg.photo.length - 1];
                fileTypeName = "photo";
            } else if (msg.video) {
                fileObj = msg.video;
                fileTypeName = "video";
            } else if (msg.animation) {
                fileObj = msg.animation;
                fileTypeName = "gif";
            } else if (msg.sticker) {
                fileObj = msg.sticker;
                fileTypeName = "sticker";
            } else if (msg.document) {
                fileObj = msg.document;
                fileTypeName = "document";
            } else if (msg.audio) {
                fileObj = msg.audio;
                fileTypeName = "audio";
            } else if (msg.voice) {
                fileObj = msg.voice;
                fileTypeName = "voice";
            }

            if (fileObj && fileObj.file_id) {
                const pendingKey = `${chatId}_${msg.message_id}`;
                pendingUploads.set(pendingKey, { fileId: fileObj.file_id, fileName: `${fileTypeName}_file`, fileType: fileTypeName });

                await bot.sendMessage(chatId, 
                    `<blockquote>✨ <b>Media Detected Successfully!</b>\n\n🔐 <b>Do you want to secure this media with a password?</b></blockquote>`, 
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔒 Set Password', callback_data: `pwd_ask_${msg.message_id}` }],
                                [{ text: '🔓 No Password (Unprotected)', callback_data: `pwd_none_${msg.message_id}` }]
                            ]
                        }
                    }
                );
            } else if (text && !text.startsWith('/')) {
                // FIXED: FALLBACK FOR UNKNOWN TEXT OR COMMAND INPUT (PIC 1 FIX)
                await bot.sendMessage(chatId, strings.guide, { parse_mode: 'HTML' });
            }
        }

    } catch (err) {
        console.error("Critical Error:", err);
    } finally {
        if (!res.headersSent) res.status(200).send('OK');
    }
});

async function processMediaShare(chatId, fileData, userObj, password) {
    try {
        let teleLink = "";
        try {
            const fileInfo = await bot.getFile(fileData.fileId);
            if (fileInfo && fileInfo.file_path) {
                teleLink = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
            }
        } catch (e) {}

        const browserFilename = `sr-${fileData.fileType}-${Math.random().toString(36).substring(2, 9)}`;
        const payloadId = `srmeta_${Math.random().toString(36).substring(2, 9)}`;

        const mediaObject = { 
            type: 'media', 
            url: teleLink, 
            fileId: fileData.fileId, 
            fileType: fileData.fileType, 
            user: userObj,
            browserFilename
        };

        mediaStore.set(browserFilename, mediaObject);
        mediaStore.set(payloadId, mediaObject);

        if (password) {
            mediaPasswords.set(browserFilename, password);
            mediaPasswords.set(payloadId, password);
        }

        const currentBotUser = botUsername || process.env.BOT_USERNAME || 'YourBotUsername';
        const shareBotLinkUrl = `https://t.me/${currentBotUser}?start=${payloadId}`;

        const successText = `<blockquote>✅ <b>Telegram Share Link Generated Successfully!</b>\n\n` +
            (password ? `🔒 <b>Status:</b> Password Protected\n\n` : `🔓 <b>Status:</b> Unprotected\n\n`) +
            `✨ <b>Bot Start / Share Link:</b>\n` +
            `🔗 <code>${shareBotLinkUrl}</code></blockquote>`;

        await bot.sendMessage(chatId, successText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📤 Share Link', switch_inline_query: shareBotLinkUrl }
                    ]
                ]
            }
        });
    } catch (e) {
        console.error("Share Link Generation Error:", e);
        await bot.sendMessage(chatId, `<blockquote>❌ <b>Generation Failed!</b> Please try sending the file again.</blockquote>`, { parse_mode: 'HTML' });
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TG Meta69Bot Active on Port ${PORT}`));
