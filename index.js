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
      const res = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(musicUrl)}&userCountry=JP`);
      const data = res.data;

      let spotify = data.linksByPlatform?.spotify?.url;
      let apple = data.linksByPlatform?.appleMusic?.url;

      // --- 強化ポイント：もしURLが見つからない場合、タイトルで再検索を試みる ---
      if (!spotify || !apple) {
        const title = data.entitiesByUniqueId[data.entityUniqueId]?.title;
        const artist = data.entitiesByUniqueId[data.entityUniqueId]?.artistName;
        
        if (title && artist) {
          // タイトルとアーティスト名でOdesliに再照会（これで引っかかる場合があります）
          const searchQuery = encodeURIComponent(`${title} ${artist}`);
          const searchRes = await axios.get(`https://api.song.link/v1-alpha.1/links?url=https://song.link/search?query=${searchQuery}&userCountry=JP`);
          
          if (!spotify) spotify = searchRes.data.linksByPlatform?.spotify?.url;
          if (!apple) apple = searchRes.data.linksByPlatform?.appleMusic?.url;
        }
      }

      if (!spotify && !apple) return;

      message.reply({
        content: `🎵 **Music Links Found**\n🍎 Apple Music: ${apple || "⚠️ 見つかりませんでした"}\n🟢 Spotify: ${spotify || "⚠️ 見つかりませんでした"}\n*(新曲の場合、紐付けに数日かかることがあります)*`,
        allowedMentions: { repliedUser: false }
      });
    } catch (e) {
      console.error('API Error');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
