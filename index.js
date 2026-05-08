const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

// ↓この3行がRenderで動かすために必要です
const app = express();
app.get('/', (req, res) => res.send('Bot is online!'));
app.listen(process.env.PORT || 10000); // ログに出ている 10000 番に合わせます

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const appleRegex = /https?:\/\/music\.apple\.com\/[^\s]+/;
  const spotifyRegex = /https?:\/\/open\.spotify\.com\/track\/[^\s?]+/;

  // 1. Apple Music → Spotify の変換
  if (appleRegex.test(message.content)) {
    const url = message.content.match(appleRegex)[0];
    try {
      // iTunes APIでメタデータを取得 (登録不要)
      const itunesRes = await axios.get(`https://itunes.apple.com/lookup?url=${encodeURIComponent(url)}&country=jp`);
      if (itunesRes.data.results.length > 0) {
        const item = itunesRes.data.results[0];
        const query = `${item.trackName} ${item.artistName}`;
        
        // 検索用リンクを生成 (song.linkの検索画面へ飛ばすことで確実に表示させる)
        const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
        const fallbackUrl = `https://song.link/s/${item.trackId || "search"}`;

        message.reply(`🎵 **Apple Musicから変換**\n🟢 Spotifyで探す: ${spotifySearchUrl}\n🔗 各種配信サイト: ${fallbackUrl}`);
      }
    } catch (e) { console.error("Apple Conversion Error"); }
  }

  // 2. Spotify → Apple Music の変換
  if (spotifyRegex.test(message.content)) {
    const url = message.content.match(spotifyRegex)[0];
    const odesliUrl = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&userCountry=JP`;
    try {
      const res = await axios.get(odesliUrl);
      const appleUrl = res.data.linksByPlatform?.appleMusic?.url;
      if (appleUrl) {
        message.reply(`🎵 **Spotifyから変換**\n🍎 Apple Music: ${appleUrl}`);
      }
    } catch (e) { console.error("Spotify Conversion Error"); }
  }
});

client.login(process.env.DISCORD_TOKEN);
