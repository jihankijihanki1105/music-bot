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
      const res = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(musicUrl)}&userCountry=JP`);
      const data = res.data;

      let spotify = data.linksByPlatform?.spotify?.url;
      let apple = data.linksByPlatform?.appleMusic?.url;

      // URLが見つからない場合の再検索ロジック
      if (!spotify || !apple) {
        const title = data.entitiesByUniqueId[data.entityUniqueId]?.title;
        const artist = data.entitiesByUniqueId[data.entityUniqueId]?.artistName;
        
        if (title && artist) {
          const searchQuery = encodeURIComponent(`${title} ${artist}`);
          const searchRes = await axios.get(`https://api.song.link/v1-alpha.1/links?url=https://song.link/search?query=${searchQuery}&userCountry=JP`);
          
          if (!spotify) spotify = searchRes.data.linksByPlatform?.spotify?.url;
          if (!apple) apple = searchRes.data.linksByPlatform?.appleMusic?.url;
        }
      }

      if (!spotify && !apple) return;

      // 文言を削除し、リンクのみのシンプルな構成に変更
      let response = `🍎 Apple Music: ${apple || "未登録"}\n🟢 Spotify: ${spotify || "未登録"}`;

      message.reply({
        content: response,
        allowedMentions: { repliedUser: false }
      });
    } catch (e) {
      console.error('API Error');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
