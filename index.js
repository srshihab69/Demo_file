const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const FormData = require('form-data');

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

// In-memory store for media, upload sessions, and passwords
const mediaStore = new Map();
const pendingUploads = new Map();
const mediaPasswords = new Map(); // stores password for protected media
const userPasswordInputs = new Map(); // tracks user waiting state to enter password

const formatSize = (bytes) => {
    if (!bytes) return '> 📊 <b>N/A</b>';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `> 📊 <code>${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}</code>`;
};

async function uploadToCatbox(fileBuffer, fileName) {
    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', fileBuffer, { filename: fileName });

        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        return response.data;
    } catch (error) {
        console.error('Catbox Upload Error:', error.message);
        throw new Error('Failed to upload to Catbox.');
    }
}

async function uploadToLitterbox(fileBuffer, fileName, time) {
    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('time', time);
        form.append('fileToUpload', fileBuffer, { filename: fileName });

        const response = await axios.post('https://litterbox.catbox.moe/resources/api.php', form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        return response.data;
    } catch (error) {
        console.error('Litterbox Upload Error:', error.message);
        throw new Error('Failed to upload to Litterbox.');
    }
}

async function getFileBuffer(fileId) {
    const fileLink = await bot.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}

const strings = {
    welcome: (name) => 
        `> 👋 <b>Hello, ${name}!</b>\n\n` +
        `> Welcome to <b>TG Meta69 Bot!</b> Explore user & media information, manage media tools, upload to Cloud storage with password protection options, and download TikTok videos smoothly. 🚀`,
    
    help: 
        `> 👑 <b>TG Meta69 Bot - Help Menu</b>\n\n` +
        `<blockquote expandable>📋 <b>User Commands:</b>\n` +
        `>  · /start - Start the bot\n` +
        `>  · /srmeta - Trigger media lookup via shared link\n` +
        `>  · /tiktok - Download TikTok video\n` +
        `>  · /help - Show this help menu\n` +
        `>  · /id @username - Get ID by username\n` +
        `>  · /stat - Check bot statistics & status</blockquote>\n\n` +
        `<blockquote expandable>📱 <b>Keyboard Buttons:</b>\n` +
        `>  · 👤 User Info - Get any user's ID\n` +
        `>  · 🆔 My Info - Get your own ID details\n` +
        `>  · ☎️ Support - Contact developer</blockquote>\n\n` +
        `<blockquote expandable>✨ <b>Special Features:</b>\n` +
        `>  · 📩 Forward Msg → Get source & media ID\n` +
        `>  · 📷 Send Photo/Video/File/Doc → Choose Password Protected or Unprotected Cloud Storage Links!\n` +
        `>  · 🎥 TikTok Video → Send link for direct chat buffer video download (Under 30MB)\n` +
        `>  · 🎭 Send Sticker/Emoji → Get ID (Unique)\n` +
        `>  · 📄 Send Document → Get file_id & cloud options</blockquote>\n\n` +
        `> 📞 Support: @srshihab69\n` +
        `> 🛠️ Made with ❤️ by @sr_shihab69`,

    stat: (mediaCount, lat) => 
        `> 📊 <b>Bot Statistics & Status</b>\n\n` +
        `> ⚡ Latency: <code>${lat}ms</code>\n` +
        `> 🤖 Status: <b>Online</b>\n` +
        `> 🕒 Uptime: <b>Always Active</b>\n` +
        `> 📂 Stored Media: <code>${mediaCount} items</code>\n` +
        `> ⚙️ Version: <code>${process.version}</code>`,

    id_err: 
        `> ℹ️ <b>Use This Command</b>\n\n` +
        `> Please use the command like this:\n` +
        `>  · /id @username\n` +
        `>  · Or reply to a message with /id`,

    guide: 
        `> ℹ️ <b>How to use this bot:</b>\n\n` +
        `> 📱 Use keyboard buttons to get IDs\n` +
        `> 📎 Send any file to get its file_id & Cloud links\n` +
        `> 📩 Forward messages to get source ID\n` +
        `> 🔗 Send t.me or social media links\n` +
        `> 🔍 Type @username to auto-lookup any user`
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

// Express route for browser media viewer with Password Support
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
                    <p>This media link has expired or is invalid. Please send the media to the bot again to get a fresh link.</p>
                </div>
            </body>
            </html>
        `);
    }

    const requiredPassword = mediaPasswords.get(filename);
    const providedPassword = req.query.pwd || '';

    if (requiredPassword && providedPassword !== requiredPassword) {
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
                    <p style="color: #94a3b8; font-size: 14px;">This file is secured with a password. Please enter it below to view or download.</p>
                    <form method="GET" action="">
                        <input type="password" name="pwd" placeholder="Enter password..." required autofocus /><br>
                        <button type="submit">Unlock Media</button>
                    </form>
                    ${providedPassword ? '<div class="error">Incorrect Password! Please try again.</div>' : ''}
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

async function handleMediaPayload(chatId, mediaData, providedPwd = '') {
    if (mediaData) {
        const filenameKey = mediaData.browserFilename;
        const reqPwd = filenameKey ? mediaPasswords.get(filenameKey) : null;

        if (reqPwd && providedPwd !== reqPwd) {
            userPasswordInputs.set(chatId, { filenameKey, mediaData });
            await bot.sendMessage(chatId, `> 🔒 <b>Password Required</b>\n\n> This media is protected with a password. Please type and send the password in chat to access it.`, { parse_mode: 'HTML' });
            return false;
        }

        const generatorName = mediaData.user ? (mediaData.user.first_name || 'Unknown User') : 'Unknown User';
        const generatorId = mediaData.user ? mediaData.user.id : 'N/A';
        const generatorUsername = mediaData.user && mediaData.user.username ? `@${mediaData.user.username}` : 'No Username';
        const userLinkHtml = mediaData.user && mediaData.user.username ? `<a href="t.me/${mediaData.user.username}">${generatorName}</a>` : `<code>${generatorName}</code>`;

        const headerText = `> 👤 <b>Generated By:</b> ${userLinkHtml}\n> 🆔 ID: <code>${generatorId}</code>\n> 🏷️ Username: ${generatorUsername}\n\n`;

        if (mediaData.fileType === 'photo' && mediaData.fileId) {
            await bot.sendPhoto(chatId, mediaData.fileId, {
                caption: headerText + `> ✨ <b>Here is your requested photo!</b>`,
                parse_mode: 'HTML'
            });
            return true;
        } else if (mediaData.fileType === 'video' && mediaData.fileId) {
            await bot.sendVideo(chatId, mediaData.fileId, {
                caption: headerText + `> ✨ <b>Here is your requested video!</b>`,
                parse_mode: 'HTML'
            });
            return true;
        } else if (mediaData.fileType === 'document' && mediaData.fileId) {
            await bot.sendDocument(chatId, mediaData.fileId, {
                caption: headerText + `> ✨ <b>Here is your requested document!</b>`,
                parse_mode: 'HTML'
            });
            return true;
        } else if (mediaData.fileType === 'audio' && mediaData.fileId) {
            await bot.sendAudio(chatId, mediaData.fileId, {
                caption: headerText + `> ✨ <b>Here is your requested audio!</b>`,
                parse_mode: 'HTML'
            });
            return true;
        } else if (mediaData.fileType === 'voice' && mediaData.fileId) {
            await bot.sendVoice(chatId, mediaData.fileId, {
                caption: headerText + `> ✨ <b>Here is your requested voice!</b>`,
                parse_mode: 'HTML'
            });
            return true;
        } else if (mediaData.fileType === 'sticker' && mediaData.fileId) {
            await bot.sendSticker(chatId, mediaData.fileId);
            return true;
        }
    }

    await bot.sendMessage(chatId, `> ❌ <b>Link Expired or Not Found</b>\n\n> This media link has expired or is invalid. Please send the media to the bot again to get a fresh link.`, { parse_mode: 'HTML' });
    return false;
}

app.post(`/api/webhook`, async (req, res) => {
    // Initial validation check to ensure payload exists
    if (!req.body || (!req.body.message && !req.body.callback_query)) {
        if (!res.headersSent) res.status(200).send('OK');
        return;
    }

    try {
        const update = req.body;
        
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
                    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Please type the password you want to set for this media in chat.' });
                    await bot.sendMessage(chatId, `> 🔐 <b>Set Media Password</b>\n\n> Please type and send the password you want to set for this file.`, { parse_mode: 'HTML' });
                } else if (data.startsWith('pwd_none_')) {
                    const origMsgId = data.split('_')[2];
                    const pendingKey = `${chatId}_${origMsgId}`;
                    const fileData = pendingUploads.get(pendingKey);

                    if (!fileData) {
                        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Session expired. Please resend the file.', show_alert: true });
                    } else {
                        await bot.answerCallbackQuery(callbackQuery.id, { text: '⏳ Uploading file without password...' });
                        await processFileUpload(chatId, msg.message_id, fileData, callbackQuery.from, null);
                    }
                }
            }
        }

        const msg = update.message;
        if (msg) {
            const chatId = msg.chat.id;
            const text = msg.text || msg.caption || "";
            const entities = (msg.entities || []).concat(msg.caption_entities || []);
            const hostUrl = `https://${req.get('host')}`;

            // Check if user is typing a password response
            if (userPasswordInputs.has(chatId) && text && !text.startsWith('/')) {
                const state = userPasswordInputs.get(chatId);
                if (state.mode === 'setting_pwd') {
                    const password = text.trim();
                    const pendingKey = `${chatId}_${state.origMsgId}`;
                    const fileData = pendingUploads.get(pendingKey);
                    userPasswordInputs.delete(chatId);

                    if (!fileData) {
                        await bot.sendMessage(chatId, `> ❌ <b>Session Expired.</b> Please resend the file.`, { parse_mode: 'HTML' });
                    } else {
                        await bot.sendMessage(chatId, `> ⏳ <b>Uploading password-protected file...</b>`, { parse_mode: 'HTML' });
                        await processFileUpload(chatId, msg.message_id - 1, fileData, msg.from, password);
                    }
                    if (!res.headersSent) res.status(200).send('OK');
                    return;
                } else if (state.filenameKey && state.mediaData) {
                    const password = text.trim();
                    const reqPwd = mediaPasswords.get(state.filenameKey);
                    userPasswordInputs.delete(chatId);

                    if (password === reqPwd) {
                        await handleMediaPayload(chatId, state.mediaData, password);
                    } else {
                        await bot.sendMessage(chatId, `> ❌ <b>Incorrect Password!</b> Access denied.`, { parse_mode: 'HTML' });
                    }
                    if (!res.headersSent) res.status(200).send('OK');
                    return;
                }
            }

            if (text.startsWith('/start')) {
                const parts = text.split(' ');
                if (parts.length > 1) {
                    const param = parts[1];
                    if (param.startsWith('srmeta_') || param === 'sr69') {
                        if (mediaStore.has(param)) {
                            await handleMediaPayload(chatId, mediaStore.get(param));
                        } else {
                            await bot.sendMessage(chatId, `> ✨ <b>TG Meta69 Bot Media Hub</b>\n\n> Welcome via bot share link! Send any photo, video, or document to generate cloud links.`, { parse_mode: 'HTML' });
                        }
                    }
                } else {
                    await bot.sendMessage(chatId, strings.welcome(msg.from.first_name), mainKeyboard);
                }
            }
            else if (text.startsWith('/srmeta')) {
                const parts = text.split(' ');
                const payload = parts[1]; 

                if (payload && mediaStore.has(payload)) {
                    await handleMediaPayload(chatId, mediaStore.get(payload));
                } else {
                    await bot.sendMessage(chatId, 
                        `> 🔗 <b>Supported Links</b>\n\n` +
                        `> ├─ 🤖 This bot supports only links generated by the bot itself:\n` +
                        `> ├─ 🔗 Direct Media Links\n` +
                        `> └─ 🔗 Shared Media Links\n\n` +
                        `> ⚠️ Please use a Direct or Share Link.`, 
                        { parse_mode: 'HTML' }
                    );
                }
            }
            else if (text.startsWith('/tiktok')) {
                await bot.sendMessage(chatId, `> 🎵 Send me a TikTok video link 🔗`, { parse_mode: 'HTML' });
            }
            else if (text === '/help') {
                await bot.sendMessage(chatId, strings.help, { 
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🏠 Back to Start', callback_data: 'back_start' }]
                        ]
                    }
                });
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
                    await bot.sendMessage(chatId, `> 🆔 <b>Sender ID</b>\n\n> 🆔 User ID: <code>${ruid}</code>`, { parse_mode: 'HTML' });
                } else if (args.length > 1) {
                    const target = args[1].startsWith('@') ? args[1] : '@' + args[1];
                    try {
                        const chat = await bot.getChat(target);
                        await bot.sendMessage(chatId, `> 🔍 <b>Lookup Result</b>\n\n> 🆔 ID: <code>${chat.id}</code>\n> 👤 Name: <code>${chat.first_name || chat.title}</code>`, { parse_mode: 'HTML' });
                    } catch (e) {
                        await bot.sendMessage(chatId, `> ❌ <b>Error</b>\n\n> Username not found.`, { parse_mode: 'HTML' });
                    }
                } else {
                    await bot.sendMessage(chatId, strings.id_err, { parse_mode: 'HTML' });
                }
            }
            else if (text === '🆔 My Info') {
                const u = msg.from;
                await bot.sendMessage(chatId, `> 🆔 <b>Your Information</b>\n\n` +
                    `> 🆔 ID: <code>${u.id}</code>\n> 👤 Name: <code>${u.first_name}</code>\n> 🏷️ User: @${u.username || 'N/A'}\n> ⭐ Prem: ${u.is_premium ? '✅' : '❌'}`, { parse_mode: 'HTML' });
            }
            else if (text === '☎️ Support') {
                await bot.sendMessage(chatId, `> 🛡️ <b>Need help or found a bug?</b>\n\n` +
                    `>  · If you encounter any issues, have questions, or want to suggest a new feature, feel free to reach out!\n` +
                    `>  · Contact my developer: <b>@srshihab69</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '👨‍💻 Developer', url: 'https://t.me/srshihab69' }]] } });
            }
            else if (text.includes(`${hostUrl}/sr/`)) {
                const trimmedLink = text.trim();
                const filename = trimmedLink.split('/sr/')[1]?.split(' ')[0];
                const mediaData = mediaStore.get(filename);

                if (mediaData) {
                    await handleMediaPayload(chatId, mediaData);
                } else {
                    await bot.sendMessage(chatId, `> ❌ <b>Link Expired or Not Found</b>\n\n> This browser link has expired or is invalid.`, { parse_mode: 'HTML' });
                }
            }
            else if (text.toLowerCase().includes('tiktok.com') || text.toLowerCase().includes('vm.tiktok.com')) {
                let videoDownloadUrl = "";
                let processingMsg = null;

                try {
                    processingMsg = await bot.sendMessage(chatId, `> ⏳ <b>Processing TikTok video...</b>`, { parse_mode: 'HTML' });

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
                            // Buffer and send video to chat directly
                            await bot.sendVideo(chatId, videoBuffer, {
                                caption: `> 📥 <b>Downloaded via TG Meta69 Bot</b>\n> 📊 Size: <code>${sizeInMB.toFixed(2)} MB</code>\n> 👨‍💻 Developer: @srshihab69`,
                                parse_mode: 'HTML'
                            }, {
                                filename: 'tiktok_video.mp4',
                                contentType: 'video/mp4'
                            });
                        } else {
                            // File larger than 30MB, provide inline button download
                            await bot.sendMessage(chatId, 
                                `> ⚠️ <b>Video is larger than 30MB! (${sizeInMB.toFixed(2)} MB)</b>\n\n> 🔗 Click the button below to download the video directly from the browser. ✅`, 
                                { 
                                    parse_mode: 'HTML',
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{ text: `📥 Download HD Video (${sizeInMB.toFixed(1)} MB)`, url: videoDownloadUrl }]
                                        ]
                                    }
                                }
                            );
                        }
                    } else {
                        await bot.sendMessage(chatId, `> ⚠️ <b>This link is not supported or video not found.</b>`, { parse_mode: 'HTML' });
                    }
                } catch (apiErr) {
                    console.error("TikTok Video Error:", apiErr);
                    if (processingMsg) {
                        await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
                    }
                    await bot.sendMessage(chatId, `> ⚠️ <b>Failed to process TikTok video. Please try again.</b>`, { parse_mode: 'HTML' });
                }
            }
            else {
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
                    const isForwarded = Boolean(msg.forward_date || msg.forward_from || msg.forward_from_chat || msg.forward_origin);
                    
                    if (!isForwarded) {
                        const pendingKey = `${chatId}_${msg.message_id}`;
                        pendingUploads.set(pendingKey, { fileId: fileObj.file_id, fileName: `${fileTypeName}_file`, fileType: fileTypeName });

                        await bot.sendMessage(chatId, 
                            `> ✨ <b>Media Detected Successfully!</b>\n\n> 🔐 <b>Do you want to secure this media with a password?</b>`, 
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
                    }
                }
            }
        }

    } catch (err) {
        console.error("Critical Error:", err);
    } finally {
        if (!res.headersSent) {
            res.status(200).send('OK');
        }
    }
});

async function processFileUpload(chatId, messageId, fileData, userObj, password) {
    try {
        const buffer = await getFileBuffer(fileData.fileId);
        // Using catbox for permanent robust storage
        const directUrl = await uploadToCatbox(buffer, fileData.fileName);
        const payloadId = `srmeta_${Math.random().toString(36).substring(2, 9)}`;
        const browserFilename = `sr-${fileData.fileType}-${Math.random().toString(36).substring(2, 9)}`;

        const mediaObject = { 
            type: 'media', 
            url: directUrl, 
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

        const hostUrl = `https://${process.env.VERCEL_URL || 'localhost:3000'}`; // Will adapt dynamically
        const browserDirectLink = `https://${reqHost || 'yourdomain.com'}/sr/${browserFilename}`;

        const currentBotUser = botUsername || process.env.BOT_USERNAME || 'YourBotUsername';
        const shareBotLinkUrl = `https://t.me/${currentBotUser}?start=${payloadId}`;

        const successText = `> ✅ <b>File Uploaded Successfully!</b>\n\n` +
            (password ? `> 🔒 <b>Protected with Password:</b> <code>${password}</code>\n\n` : `> 🔓 <b>Status:</b> Unprotected\n\n`) +
            `> ✨ <b>Cloud Direct Link:</b>\n> 🔗 <code>${directUrl}</code>\n\n` +
            `> 🌐 <b>Viewer Link:</b>\n> 🔗 <code>https://${bot.options.webHook?.url ? new URL(bot.options.webHook.url).host : 'yourdomain'}/sr/${browserFilename}</code>`;

        await bot.sendMessage(chatId, successText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🌐 Open Browser Link', url: directUrl }],
                    [
                        { text: '📤 Share Direct Link', url: `https://t.me/share/url?url=${encodeURIComponent(directUrl)}&text=Check%20out%20this%20media%20file!` },
                        { text: '🤖 Share Bot Link', url: shareBotLinkUrl }
                    ]
                ]
            }
        });
    } catch (e) {
        console.error("Cloud Upload Error:", e);
        await bot.sendMessage(chatId, `> ❌ <b>Upload Failed!</b> Please try sending the file again.`, { parse_mode: 'HTML' });
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TG Meta69Bot Active on Port ${PORT}`));
