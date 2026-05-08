const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
// Renderの要求するポート番号に対応させます
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`✅ Web Server listening on port ${port}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ログイン成功時にログを出す
client.on('ready', () => {
  console.log(`✅✅✅ Discordログイン成功！ Bot名: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const regex = /(https?:\/\/(open\.spotify\.com|music\.apple\.com)\/[^\s]+)/;
  const match = message.content.match(regex);

  if (match) {
    const musicUrl = match[0];
    try {
      const res = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(musicUrl)}&userCountry=JP`);
      const spotify = res.data.linksByPlatform?.spotify?.url;
      const apple = res.data.linksByPlatform?.appleMusic?.url;

      if (!spotify && !apple) return;

      message.reply({
        content: `🎵 **Music Links Found**\n🍎 Apple Music: ${apple || "⚠️ 見つかりませんでした"}\n🟢 Spotify: ${spotify || "⚠️ 見つかりませんでした"}`,
        allowedMentions: { repliedUser: false }
      });
    } catch (e) {
      console.error('API Error');
    }
  }
});

// ログインエラーをログに出すための設定
process.on('unhandledRejection', error => {
  console.error('❌ ログインエラー発生:', error.message);
});

// トークンが空っぽでないかチェックしてからログイン
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN が設定されていません！');
} else {
  console.log('⏳ Discordにログインを試みています...');
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('❌ ログイン失敗:', err.message);
  });
}
