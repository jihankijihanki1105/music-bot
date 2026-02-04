const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  // セルフピンガー（眠り防止）
  setInterval(async () => {
    try {
      const hostname = process.env.RENDER_EXTERNAL_HOSTNAME;
      if (hostname) {
        await axios.get(`https://${hostname}`).catch(() => {});
        console.log('Self-ping success!');
      }
    } catch (e) {
      // エラーは無視
    }
  }, 10 * 60 * 1000); 
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 音楽情報を取得する関数
async function fetchMusicData(url, retryCount = 0) {
  try {
    const res = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&userCountry=JP`, { timeout: 7000 });
    return res.data;
  } catch (error) {
    if (retryCount < 1) return fetchMusicData(url, retryCount + 1);
    throw error;
  }
}

// 検索ワードをきれいにする関数
function cleanText(text) {
  if (!text) return "";
  return text
    .split(/feat\.|ft\.|with|w\//i)[0]
    .replace(/\(.*\)|\[.*\]|- Single|- EP|Remastered|Version|Digital/gi, '')
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

      // 見つからない場合の検索強化ロジック
      if (!spotify || !apple) {
        const entity = data.entitiesByUniqueId[data.entityUniqueId];
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

      // ★追加：元のメッセージのプレビュー（カード）を消す処理
      try {
        await message.suppressEmbeds(true);
      } catch (err) {
        console.log("プレビュー消去権限（メッセージの管理）がありません");
      }

      // 返信する
      message.reply({
        content: `🍎 Apple Music: ${apple || "未登録"}\n🟢 Spotify: ${spotify || "未登録"}`,
        allowedMentions: { repliedUser: false }
      });
    } catch (e) {
      console.error(`Error: ${musicUrl}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
