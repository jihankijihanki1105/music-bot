const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  // 10分ごとに自分自身を叩き起こす（スリープ防止）
  setInterval(async () => {
    try {
      const hostname = process.env.RENDER_EXTERNAL_HOSTNAME;
      if (hostname) await axios.get(`https://${hostname}`).catch(() => {});
    } catch (e) {}
  }, 10 * 60 * 1000); 
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// URLから検索キーワードを抽出するバックアップ機能
function extractKeywordsFromUrl(url) {
  try {
    const decoded = decodeURIComponent(url);
    const parts = decoded.split('/');
    const lastPart = parts[parts.length - 1].split('?')[0]; // 曲名/ID
    const albumPart = parts[parts.length - 2] || ""; // アーティストやアルバム名
    return `${albumPart} ${lastPart}`.replace(/-/g, ' ').trim();
  } catch (e) { return ""; }
}

// 音楽情報を取得する関数（最大3回・最大30秒粘る）
async function fetchMusicData(url, retryCount = 0) {
  try {
    const res = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&userCountry=JP`, { timeout: 12000 });
    return res.data;
  } catch (error) {
    if (retryCount < 3) {
      const waitTime = (retryCount + 1) * 5000; // 5s, 10s, 15s と間隔を広げる
      console.log(`取得失敗（${retryCount + 1}回目）。${waitTime/1000}秒後にリトライします...`);
      await sleep(waitTime);
      return fetchMusicData(url, retryCount + 1);
    }
    throw error;
  }
}

// 検索ワードから余計な文字を消す
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
    
    // 🔍 リアクションを付けて「検索中」をアピール
    let reaction;
    try { 
      reaction = await message.react('🔍').catch(() => null); 
      await message.channel.sendTyping(); // 「入力中...」も表示
    } catch(e){}

    try {
      let data = await fetchMusicData(musicUrl).catch(() => null);
      
      // 直接のURL検索がダメなら、URL内の文字から検索を試みる（バックアップ）
      if (!data) {
        const keywords = extractKeywordsFromUrl(musicUrl);
        if (keywords) {
          const searchQuery = `https://song.link/search?query=${encodeURIComponent(keywords)}`;
          data = await fetchMusicData(searchQuery).catch(() => null);
        }
      }

      if (!data) {
        if (reaction) reaction.users.remove(client.user.id).catch(() => {});
        return;
      }

      let spotify = data.linksByPlatform?.spotify?.url;
      let apple = data.linksByPlatform?.appleMusic?.url;

      // 精度向上のための追加検索
      if (!spotify || !apple) {
        const entity = data.entitiesByUniqueId[data.entityUniqueId];
        const title = cleanText(entity?.title);
        const artist = cleanText(entity?.artistName);
        if (title && artist) {
          const searchData = await fetchMusicData(`https://song.link/search?query=${encodeURIComponent(`${title} ${artist}`)}`).catch(() => null);
          if (searchData) {
            if (!spotify) spotify = searchData.linksByPlatform?.spotify?.url;
            if (!apple) apple = searchData.linksByPlatform?.appleMusic?.url;
          }
        }
      }

      if (spotify || apple) {
        // 元のURLプレビューを消す（要：メッセージ管理権限）
        message.suppressEmbeds(true).catch(() => {});
        
        // 結果を返信
        await message.reply({
          content: `🍎 Apple Music: ${apple || "未登録"}\n🟢 Spotify: ${spotify || "未登録"}`,
          allowedMentions: { repliedUser: false }
        });
      }
    } catch (e) {
      console.error(`Error processing: ${musicUrl}`);
    } finally {
      // 終わったら 🔍 リアクションを外す
      if (reaction) reaction.users.remove(client.user.id).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
