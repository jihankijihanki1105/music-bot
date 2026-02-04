const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  setInterval(async () => {
    try {
      const hostname = process.env.RENDER_EXTERNAL_HOSTNAME;
      if (hostname) {
        await axios.get(`https://${hostname}`).catch(() => {});
      }
    } catch (e) {}
  }, 10 * 60 * 1000); 
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// 指定した秒数待機するヘルパー関数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 音楽情報を取得する関数（リトライ機能を強化）
async function fetchMusicData(url, retryCount = 0) {
  try {
    // タイムアウトを10秒に少し伸ばしました
    const res = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&userCountry=JP`, { timeout: 10000 });
    return res.data;
  } catch (error) {
    // 2回までリトライする（失敗したら3秒待ってから次へ）
    if (retryCount < 2) {
      console.log(`取得失敗、${retryCount + 1}回目のリトライをします...`);
      await sleep(3000); 
      return fetchMusicData(url, retryCount + 1);
    }
    throw error;
  }
}

function cleanText(text) {
  if (!text) return "";
  return text.split(/feat\.|ft\.|with|w\//i)[0].replace(/\(.*\)|\[.*\]|- Single|- EP|Remastered|Version|Digital/gi, '').trim();
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const regex = /(https?:\/\/(open\.spotify\.com|music\.apple\.com)\/[^\s]+)/;
  const match = message.content.match(regex);

  if (match) {
    const musicUrl = match[0];
    
    // 処理開始の合図（👀リアクション）を付ける
    let reaction;
    try { reaction = await message.react('👀').catch(() => null); } catch(e){}

    try {
      const data = await fetchMusicData(musicUrl);
      let spotify = data.linksByPlatform?.spotify?.url;
      let apple = data.linksByPlatform?.appleMusic?.url;

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

      if (spotify || apple) {
        // 元のプレビューを消す
        message.suppressEmbeds(true).catch(() => {});
        
        // 返信する
        await message.reply({
          content: `🍎 Apple Music: ${apple || "未登録"}\n🟢 Spotify: ${spotify || "未登録"}`,
          allowedMentions: { repliedUser: false }
        });
      }
    } catch (e) {
      console.error(`Error processing: ${musicUrl}`);
    } finally {
      // 終わったらリアクションを消す
      if (reaction) reaction.users.remove(client.user.id).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
