const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const regex = /(https?:\/\/(open\.spotify\.com|music\.apple\.com)\/[^\s]+)/;
  const match = message.content.match(regex);

  if (match) {
    const inputUrl = match[0];
    try {
      // 1. まずはメインの Odesli API を試す
      const res = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(inputUrl)}&userCountry=JP`);
      const data = res.data;

      let spotify = data.linksByPlatform?.spotify?.url;
      let apple = data.linksByPlatform?.appleMusic?.url;

      // 2. もし Spotify が見つからなかった場合、iTunes API 経由で再検索
      if (!spotify && inputUrl.includes('apple.com')) {
        console.log('Searching via iTunes/Metadata backup...');
        const entityId = data.entityUniqueId;
        const title = data.entitiesByUniqueId[entityId]?.title;
        const artist = data.entitiesByUniqueId[entityId]?.artistName;

        if (title && artist) {
          // 曲名とアーティスト名で再度 Odesli に検索をかける
          const searchQuery = `https://api.song.link/v1-alpha.1/links?url=https://song.link/search?query=${encodeURIComponent(title + " " + artist)}&userCountry=JP`;
          const searchRes = await axios.get(searchQuery);
          spotify = searchRes.data.linksByPlatform?.spotify?.url;
        }
      }

      // 3. レスポンス送信
      if (spotify || apple) {
        message.reply({
          content: `🎵 **リンクが見つかりました**\n🍎 Apple Music: ${apple || "⚠️ 見つかりませんでした"}\n🟢 Spotify: ${spotify || "⚠️ 見つかりませんでした"}\n*(Odesli APIの遅延により表示されない場合があります)*`,
          allowedMentions: { repliedUser: false }
        });
      }
    } catch (e) {
      console.error('API Error:', e.message);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
