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

// 音楽情報を取得する共通関数（エラー時にリトライする機能付き）
async function fetchMusicData(url, retryCount = 0) {
  try {
    const res = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&userCountry=JP`, {
      timeout: 5000 // 5秒でタイムアウト
    });
    return res.data;
  } catch (error) {
    if (retryCount < 1) { // 1回だけリトライ
      console.log('Retry fetching...');
      return fetchMusicData(url, retryCount + 1);
    }
    throw error;
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const regex = /(https?:\/\/(open\.spotify\.com|music\.apple\.com)\/[^\s]+)/;
  const match = message.content.match(regex);

  if (match) {
    const musicUrl = match[0];
    try {
      const data = await fetchMusicData(musicUrl);

      let spotify = data.linksByPlatform?.spotify?.url;
      let apple = data.linksByPlatform?.appleMusic?.url;

      // URLが見つからない場合の再検索
      if (!spotify || !apple) {
        const title = data.entitiesByUniqueId[data.entityUniqueId]?.title;
        const artist = data.entitiesByUniqueId[data.entityUniqueId]?.artistName;
        
        if (title && artist) {
          const searchQuery = `https://song.link/search?query=${encodeURIComponent(`${title} ${artist}`)}`;
          const searchData = await fetchMusicData(searchQuery).catch(() => null);
          
          if (searchData) {
            if (!spotify) spotify = searchData.linksByPlatform?.spotify?.url;
            if (!apple) apple = searchData.linksByPlatform?.appleMusic?.url;
          }
        }
      }

      if (!spotify && !apple) return;

      message.reply({
        content: `🍎 Apple Music: ${apple || "未登録"}\n🟢 Spotify: ${spotify || "未登録"}`,
        allowedMentions: { repliedUser: false }
      });
    } catch (e) {
      // ログを詳しく出す
      console.error(`[Error] URL: ${musicUrl}`);
      console.error(`Reason: ${e.response ? e.response.status : e.message}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
