const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // セルフピンガー（眠り防止）
  setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : null;
    if (url) axios.get(url).catch(() => {});
  }, 10 * 60 * 1000);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

async function fetchMusicData(url, retryCount = 0) {
  try {
    const res = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&userCountry=JP`, { timeout: 7000 });
    return res.data;
  } catch (error) {
    if (retryCount < 1) return fetchMusicData(url, retryCount + 1);
    throw error;
  }
}

// --- 強化されたクリーニング関数 ---
function cleanText(text) {
  if (!text) return "";
  return text
    .split(/feat\.|ft\.|with|w\//i)[0] // feat. 以降をカット
    .replace(/\(.*\)|\[.*\]|- Single|- EP|Remastered|Version|Digital/gi, '') // カッコ内や配信形態を削除
    .trim();
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

      // 検索強化ロジック
      if (!spotify || !apple) {
        const entity = data.entitiesByUniqueId[data.entityUniqueId];
        // 曲名とアーティスト名の両方をクリーニングして検索精度を上げる
        const title = cleanText(entity?.title);
        const artist = cleanText(entity?.artistName);
        
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
      console.error(`Error processing URL: ${musicUrl}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
