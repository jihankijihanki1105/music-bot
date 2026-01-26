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
      const spotify = res.data.linksByPlatform.spotify?.url || "未登録";
      const apple = res.data.linksByPlatform.appleMusic?.url || "未登録";

      message.reply({
        content: `🎵 **Music Link Converted!**\n🍎 Apple Music: ${apple}\n🟢 Spotify: ${spotify}`,
        allowedMentions: { repliedUser: false }
      });
    } catch (e) { console.error(e); }
  }
});

client.login(process.env.DISCORD_TOKEN); // ここでトークンを読み込みます