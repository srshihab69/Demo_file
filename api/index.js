export default async function handler(req, res) {
  const BOT_TOKEN = process.env.BOT_TOKEN; 

  if (!BOT_TOKEN) {
    console.error("❌ ERROR: BOT_TOKEN is missing in Vercel Environment Variables!");
    return res.status(500).json({ error: "BOT_TOKEN is missing" });
  }

  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

  try {
    if (req.method === 'POST') {
      const update = req.body;

      if (update && update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        
        const firstName = update.message.from.first_name || 'User';
        const lastName = update.message.from.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();

        if (text === '/start') {
          const welcomeMessage = 
            `👋 <b>Hello, ${fullName}! ❞</b>\n\n` +
            `<blockquote>Welcome to <b>NexaEarn (Apex)</b>.\n` +
            `Click the button below to open the app inside Telegram, or check out our support and update channels.</blockquote>`;

          const replyMarkup = {
            inline_keyboard: [
              [
                { 
                  text: '💫 TG BotCast Engine', 
                  url: 'https://t.me/ChannelChontrollerBot/MyApp',
                  style: 'primary' 
                }
              ],
              [
                { 
                  text: '💬 Support', 
                  url: 'https://t.me/GlobalSupportHQ',
                  style: 'success' 
                },
                { 
                  text: '📢 Update News', 
                  url: 'https://t.me/nexaearnapex',
                  style: 'success' 
                }
              ]
            ]
          };

          const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: welcomeMessage,
              parse_mode: 'HTML',
              reply_markup: replyMarkup
            })
          });
          
          const result = await response.json();
          if (!result.ok) {
            console.error("Telegram API Error:", result.description);
          }
        }
      }

      return res.status(200).json({ status: 'success' });
    }
  } catch (error) {
    console.error("Fetch Error:", error);
    return res.status(200).json({ error: error.message });
  }

  return res.status(200).json({ message: 'NexGen Bot is running smoothly on Vercel!' });
}
