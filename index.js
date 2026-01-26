const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // 正規表現を少し広めに設定（共有用URLなども拾えるように）
  const regex = /(https?:\/\/(open\.spotify\.com|music\.apple\.com|song\.link)\/[^\s]+)/;
  const match = message.content.match(regex);

  if (match) {
    const musicUrl = match[0];
    try {
      // APIリクエスト（userCountry=JPを明示し、エラーハンド答を詳細化）
      const res = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(musicUrl)}&userCountry=JP`);
      const data = res.data;

      // データの取得先を安全にチェック
      const spotify = data.linksByPlatform?.spotify?.url;
      const apple = data.linksByPlatform?.appleMusic?.url;

      // 両方見つからない場合はスルー（関係ないURLへの誤爆防止）
      if (!spotify && !apple) return;

      // メッセージ作成
      let response = `🎵 **Music Links**\n`;
      response += `🍎 Apple Music: ${apple || "見つかりませんでした"}\n`;
      response += `🟢 Spotify: ${spotify || "見つかりませんでした"}`;

      // 片方が「未登録」でも、もう片方があれば表示
      message.reply({
        content: response,
        allowedMentions: { repliedUser: false }
      });
    } catch (e) {
      console.error('API Error:', e.message);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
