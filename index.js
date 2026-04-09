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

  const regex = /(https?:\/\/(open\.spotify\.com|music\.apple\.com)\/[^\s]+)/;
  const match = message.content.match(regex);

  if (match) {
    const musicUrl = match[0];
    try {
      // APIリクエスト
      const apiUrl = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(musicUrl)}&userCountry=JP`;
      const res = await axios.get(apiUrl);
      const data = res.data;

      // 1. まず普通にSpotifyリンクを探す
      let spotify = data.linksByPlatform?.spotify?.url;
      let apple = data.linksByPlatform?.appleMusic?.url;

      // 2. もし見つからない場合、API内の全データ(entities)をスキャンして無理やり探す
      if (!spotify) {
        for (const key in data.entitiesByUniqueId) {
          const entity = data.entitiesByUniqueId[key];
          if (entity.platforms.includes("spotify")) {
            // 見つかったら、APIにその特定のIDで再照会
            const retryRes = await axios.get(`https://api.song.link/v1-alpha.1/links?id=${key}&userCountry=JP`);
            spotify = retryRes.data.linksByPlatform?.spotify?.url;
            if (spotify) break;
          }
        }
      }

      // 3. 結果を送信
      if (spotify || apple) {
        message.reply({
          content: `🎵 **Link Conversion Result**\n🍎 Apple Music: ${apple || "⚠️ データ未取得"}\n🟢 Spotify: ${spotify || "⚠️ 未登録 (検索失敗)"}`,
          allowedMentions: { repliedUser: false }
        });
      }
    } catch (e) {
      console.error('Conversion error:', e.message);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
