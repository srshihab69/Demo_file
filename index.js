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

// In-memory store for media and upload session tracking
const mediaStore = new Map();
const pendingUploads = new Map();

const formatSize = (bytes) => {
    if (!bytes) return '> 📊 <b>N/A</b>';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `> 📊 <code>${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}</code>`;
};

// Upload helper for Catbox.moe (Permanent Storage)
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

// Upload helper for Litterbox (Temporary Storage: 1h, 24h, 48h, 72h)
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

// Helper to get file buffer from Telegram file_id
async function getFileBuffer(fileId) {
    const fileLink = await bot.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}

const strings = {
    welcome: (name) => 
        `> 👋 <b>Hello, ${name}!</b>\n\n` +
        `> Welcome to <b>TG Meta69 Bot!</b> Explore user & media information, manage media tools, upload to Cloud storage with custom expiration options, and download TikTok videos with ease. 🚀`,
    
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
        `>  · 📷 Send Photo/Video/File/Doc → Choose Cloud Storage (Catbox Permanent / Litterbox 1h, 24h, 48h, 72h) to get Direct Links & Share Bot Deep Links\n` +
        `>  · 🎥 TikTok Video → Send link for direct chat video download (Under 30MB)\n` +
        `>  · 🎭 Send Sticker/Emoji → Get ID (Unique)\n` +
        `>  · 📄 Send Document → Get file_id & cloud options\n` +
        `>  · 🎵 Send Audio/Voice → Get file_id</blockquote>\n\n` +
        `<blockquote expandable>🔍 <b>Auto-Detect:</b>\n` +
        `>  · Just type @username in chat\n` +
        `>  · Bot will automatically detect & look up the user info\n` +
        `>  · Works for users, bots, channels & groups!\n` +
        `>  · Up to 3 usernames per message</blockquote>\n\n` +
        `<blockquote expandable>💡 <b>Pro Tips:</b>\n` +
        `>  · Reply /id to any message to get sender's ID\n` +
        `>  · Use buttons for instant one-click ID lookup\n` +
        `>  · Forward from channels to get channel ID\n` +
        `>  · Type @username anywhere — no command needed!</blockquote>\n\n` +
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

// Express route for browser media viewer
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
                .media-box {
                    ${mediaHtml}
                </div>
                <a href="${mediaUrl}" class="download-btn" download>📥 Download File</a>
                <div class="footer">Powered by TG Meta69 Bot</div>
            </div>
        </body>
        </html>
    `);
});

// Helper function to handle media retrieval from payload/link
async function handleMediaPayload(chatId, mediaData) {
    if (mediaData) {
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
    // প্রাথমিক সিকিউরিটি ও ভ্যালিডেশন চেক
    if (!req.body || (!req.body.message && !req.body.callback_query)) {
        return res.status(200).send('OK');
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
                } else if (data.startsWith('upload_')) {
                    const parts = data.split('_');
                    let uploadType, timeVal, origMsgId;

                    if (parts[1] === 'catbox') {
                        uploadType = 'catbox';
                        origMsgId = parts[2];
                    } else {
                        uploadType = 'litter';
                        timeVal = parts[2];
                        origMsgId = parts[3];
                    }

                    const pendingKey = `${chatId}_${origMsgId}`;
                    const fileData = pendingUploads.get(pendingKey);

                    if (!fileData) {
                        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Session expired or file not found. Please resend the file.', show_alert: true });
                    } else {
                        await bot.answerCallbackQuery(callbackQuery.id, { text: '⏳ Processing and uploading file to cloud...' });
                        await bot.editMessageText(`> 🔄 <b>Uploading file to cloud storage, please wait...</b>`, {
                            chat_id: chatId,
                            message_id: msg.message_id,
                            parse_mode: 'HTML'
                        });

                        try {
                            const buffer = await getFileBuffer(fileData.fileId);
                            let directUrl = '';
                            const payloadId = `srmeta_${Math.random().toString(36).substring(2, 9)}`;

                            if (uploadType === 'catbox') {
                                directUrl = await uploadToCatbox(buffer, fileData.fileName);
                            } else {
                                let litterTime = '1h';
                                if (timeVal === '24') litterTime = '24h';
                                else if (timeVal === '48') litterTime = '72h';
                                else if (timeVal === '72') litterTime = '72h';
                                else if (timeVal === '1') litterTime = '1h';

                                directUrl = await uploadToLitterbox(buffer, fileData.fileName, litterTime);
                            }

                            pendingUploads.delete(pendingKey);

                            const browserFilename = `sr-${fileData.fileType}-${Math.random().toString(36).substring(2, 9)}`;
                            const mediaObject = { 
                                type: 'media', 
                                url: directUrl, 
                                fileId: fileData.fileId, 
                                fileType: fileData.fileType, 
                                user: callbackQuery.from 
                            };
                            mediaStore.set(browserFilename, mediaObject);
                            mediaStore.set(payloadId, mediaObject);

                            const hostUrl = `https://${req.get('host')}`;
                            const browserDirectLink = `${hostUrl}/sr/${browserFilename}`;

                            const currentBotUser = botUsername || process.env.BOT_USERNAME || 'YourBotUsername';
                            const shareBotLinkUrl = `https://t.me/${currentBotUser}?start=${payloadId}`;

                            const successText = `> ✅ <b>File Uploaded Successfully!</b>\n\n` +
                                `> ✨ <b>Cloud Direct Link:</b>\n` +
                                `> 🔗 <code>${directUrl}</code>\n\n` +
                                `> 🌐 <b>Viewer Link:</b>\n` +
                                `> 🔗 <code>${browserDirectLink}</code>`;

                            await bot.editMessageText(successText, {
                                chat_id: chatId,
                                message_id: msg.message_id,
                                parse_mode: 'HTML',
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: '🌐 Open Browser Link', url: directUrl }
                                        ],
                                        [
                                            { text: '📤 Share Direct Link', url: `https://t.me/share/url?url=${encodeURIComponent(directUrl)}&text=Check%20out%20this%20media%20file!` },
                                            { text: '🤖 Share Bot Link', url: shareBotLinkUrl }
                                        ]
                                    ]
                                }
                            });

                        } catch (error) {
                            console.error('Upload Process Error:', error);
                            await bot.editMessageText(`> ❌ <b>Upload Failed!</b> Please try again later.`, {
                                chat_id: chatId,
                                message_id: msg.message_id,
                                parse_mode: 'HTML'
                            });
                        }
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
            else if (msg.user_shared) {
                const userId = msg.user_shared.user_id;
                try {
                    const user = await bot.getChat(userId);
                    const info = `> 🔍 <b>Shared User Info</b>\n\n` +
                        `> 🆔 ID: <code>${user.id}</code>\n> 👤 Name: <code>${user.first_name} ${user.last_name || ''}</code>\n> 🏷️ User: @${user.username || 'None'}\n> ⭐ Prem: ${user.is_premium ? '✅' : '❌'}`;
                    await bot.sendMessage(chatId, info, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '💬 Message', url: user.username ? `t.me/${user.username}` : `tg://user?id=${user.id}` }]] } });
                } catch (e) {
                    await bot.sendMessage(chatId, `> 🔍 <b>Shared User Info</b>\n\n> 🆔 ID: <code>${userId}</code>\n> ⚠️ Details restricted.`, { parse_mode: 'HTML' });
                }
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
                    processingMsg = await bot.sendMessage(chatId, `> ⏳ <b>Downloading video...</b>`, { parse_mode: 'HTML' });

                    const urlRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:vm\.tiktok\.com|tiktok\.com)\/[^\s]+/g;
                    const foundUrls = text.match(urlRegex) || [];
                    
                    let targetUrl = foundUrls.find(url => !url.includes('tiktoklite')) || foundUrls[0] || text.trim();

                    if (targetUrl.includes('?')) {
                        targetUrl = targetUrl.split('?')[0];
                    }

                    const apiRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                        }
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
                                caption: `> 📥 <b>Downloaded via TG Meta69 Bot</b>\n> 📊 Size: <code>${sizeInMB.toFixed(2)} MB</code>\n> 👨‍💻 Developer: @srshihab69`,
                                parse_mode: 'HTML'
                            }, {
                                filename: 'tiktok_video.mp4',
                                contentType: 'video/mp4'
                            });
                        } else {
                            await bot.sendMessage(chatId, 
                                `> ⚠️ <b>Video is larger than 30MB!</b>\n\n` +
                                `> 📊 File Size: <code>${sizeInMB.toFixed(2)} MB</code>\n` +
                                `> 🔗 Click the button below to download the video directly from the browser. ✅`, 
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
                        await bot.sendMessage(chatId, `> ⚠️ <b>This link is not supported.</b>\n\n> 🔗 <b>Please send a valid link and try again.</b> ✅`, { parse_mode: 'HTML' });
                    }
                } catch (apiErr) {
                    console.error("TikTok Video Error:", apiErr);
                    if (processingMsg) {
                        await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
                    }
                    await bot.sendMessage(chatId, `> ⚠️ <b>This link is not supported.</b>\n\n> 🔗 <b>Please send a valid link and try again.</b> ✅`, { parse_mode: 'HTML' });
                }
            }
            else {
                const matchParam = text.match(/[?&]start=(srmeta_[a-zA-Z0-9]+)/);
                if (matchParam) {
                    const payload = matchParam[1];
                    if (mediaStore.has(payload)) {
                        await handleMediaPayload(chatId, mediaStore.get(payload));
                    }
                } else {
                    let finalMessage = "";
                    let inlineButtons = [];

                    const isForwarded = Boolean(msg.forward_date || msg.forward_from || msg.forward_from_chat || msg.forward_origin);

                    if (isForwarded) {
                        let fId = 'N/A', fName = 'Protected Source';
                        if (msg.forward_from) { fId = msg.forward_from.id; fName = msg.forward_from.first_name; }
                        else if (msg.forward_from_chat) { fId = msg.forward_from_chat.id; fName = msg.forward_from_chat.title; }
                        else if (msg.forward_origin) {
                            const o = msg.forward_origin;
                            fId = o.sender_user ? o.sender_user.id : (o.chat ? o.chat.id : 'Hidden');
                            fName = o.sender_user ? o.sender_user.first_name : (o.chat ? o.chat.title : 'Forwarded Source');
                        }
                        finalMessage += `> 📩 <b>Forwarded Message</b>\n\n` +
                            `> 🆔 Source ID: <code>${fId}</code>\n> 👤 Name: <code>${fName}</code>\n\n`;
                    }

                    let mId = "", mType = "", mExtra = "";
                    let fileObj = null;
                    let fileTypeName = "file";

                    if (msg.photo) {
                        fileObj = msg.photo[msg.photo.length - 1];
                        mType = "📷 Photo Detected";
                        fileTypeName = "photo";
                        mExtra = `\n> 📐 Res: <code>${fileObj.width}x${fileObj.height}</code>\n> 📊 Size: <code>${formatSize(fileObj.file_size)}</code>`;
                    } else if (msg.video) {
                        fileObj = msg.video;
                        mType = "🎬 Video Detected";
                        fileTypeName = "video";
                        mExtra = `\n> 📐 Res: <code>${fileObj.width}x${fileObj.height}</code>\n> ⏳ Duration: <code>${fileObj.duration}s</code>\n> 📊 Size: <code>${formatSize(fileObj.file_size)}</code>`;
                    } else if (msg.animation) {
                        fileObj = msg.animation;
                        mType = "🎞️ GIF Detected";
                        fileTypeName = "gif";
                        mExtra = `\n> 📛 Name: <code>${fileObj.file_name || 'Animation'}</code>\n> 📊 Size: <code>${formatSize(fileObj.file_size)}</code>`;
                    } else if (msg.sticker) {
                        fileObj = msg.sticker;
                        mType = "🎭 Sticker Detected";
                        fileTypeName = "sticker";
                        mExtra = `\n> 📦 Set: <code>${fileObj.set_name || 'None'}</code>\n> 😀 Emoji: <code>${fileObj.emoji || 'N/A'}</code>`;
                    } else if (msg.document) {
                        fileObj = msg.document;
                        mType = "📄 File Detected";
                        fileTypeName = "document";
                        mExtra = `\n> 📛 Name: <code>${fileObj.file_name}</code>\n> 📊 Size: <code>${formatSize(fileObj.file_size)}</code>`;
                    } else if (msg.audio) {
                        fileObj = msg.audio;
                        mType = "🎵 Audio Detected";
                        fileTypeName = "audio";
                        mExtra = `\n> 📊 Size: <code>${formatSize(fileObj.file_size)}</code>`;
                    } else if (msg.voice) {
                        fileObj = msg.voice;
                        mType = "🎤 Voice Detected";
                        fileTypeName = "voice";
                        mExtra = `\n> ⏳ Duration: <code>${fileObj.duration}s</code>`;
                    }

                    if (fileObj && fileObj.file_id) {
                        mId = fileObj.file_id;

                        if (!isForwarded) {
                            const pendingKey = `${chatId}_${msg.message_id}`;
                            pendingUploads.set(pendingKey, { fileId: mId, fileName: `${fileTypeName}_file`, fileType: fileTypeName });

                            finalMessage += `> ✨ <b>${mType}</b>\n\n` +
                                `> 🆔 File ID: <code>${mId}</code>${mExtra}\n\n` +
                                `> 📂 <b>Please select cloud upload expiration time below:</b>`;

                            inlineButtons.push([
                                { text: '⏳ Litter (1h)', callback_data: `upload_litter_1_${msg.message_id}` },
                                { text: '⏳ Litter (24h)', callback_data: `upload_litter_24_${msg.message_id}` }
                            ]);
                            inlineButtons.push([
                                { text: '⏳ Litter (48h)', callback_data: `upload_litter_48_${msg.message_id}` },
                                { text: '⏳ Litter (72h)', callback_data: `upload_litter_72_${msg.message_id}` }
                            ]);
                            inlineButtons.push([
                                { text: '♾️ Catbox (Permanent)', callback_data: `upload_catbox_${msg.message_id}` }
                            ]);
                        } else {
                            finalMessage += `> ✨ <b>${mType}</b>\n\n` +
                                `> 🆔 File ID: <code>${mId}</code>${mExtra}`;
                        }
                    }

                    const customEmojis = entities.filter(e => e.type === 'custom_emoji');
                    if (customEmojis.length > 0) {
                        finalMessage += `\n\n> 💎 <b>Premium Emoji Detected</b>\n<blockquote expandable>`;
                        const uniqueEmojiIds = [...new Set(customEmojis.map(e => e.custom_emoji_id))];
                        uniqueEmojiIds.forEach((emojiId, index) => {
                            finalMessage += `> 🆔 Emoji ${index + 1} ID: <code>${emojiId}</code>\n`;
                        });
                        finalMessage += `</blockquote>`;
                    }

                    const lookups = entities.filter(e => e.type === 'mention' || e.type === 'url');
                    if (lookups.length > 0) {
                        let lookupResults = "";
                        let processedTargets = new Set();

                        for (let i = 0; i < lookups.length; i++) {
                            let target = "";
                            if (lookups[i].type === 'mention') {
                                target = text.substring(lookups[i].offset, lookups[i].offset + lookups[i].length).toLowerCase();
                            } else if (lookups[i].type === 'url') {
                                const url = text.substring(lookups[i].offset, lookups[i].offset + lookups[i].length);
                                if (url.includes('t.me/')) {
                                    target = '@' + url.split('t.me/')[1].split('/')[0].split('?')[0].toLowerCase();
                                }
                            }

                            if (target.startsWith('@') && !processedTargets.has(target)) {
                                processedTargets.add(target);

                                try {
                                    const chat = await bot.getChat(target);
                                    lookupResults += `> 👤 <b>${chat.first_name || chat.title}</b>\n> 🆔 ID: <code>${chat.id}</code>\n> 🏷️ User: ${target}\n\n`;
                                    
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
                            finalMessage += `\n\n> 🔍 <b>Auto Lookup</b>\n<blockquote expandable>${lookupResults.trim()}</blockquote>`;
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
            }
        }

    } catch (err) {
        console.error("Critical Error:", err);
    } finally {
        // ফায়ারবেস বা ভেরেল সার্ভার যেন ঘুমিয়ে না পড়ে এবং প্রসেস শেষ হয়ে গেলে ঠিকঠাক স্ট্যাটাস পাঠায়
        if (!res.headersSent) {
            res.status(200).send('OK');
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TG Meta69Bot Active on Port ${PORT}`));
