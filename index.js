const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// Renderを維持するための最小限のサーバー
const app = express();
app.get('/', (req, res) => res.send('Bot is Live'));
app.listen(process.env.PORT || 10000);

// 必要最低限の権限のみ指定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ログインできたら絶対にログを出す
client.once('ready', () => {
  console.log('------------------------------');
  console.log(`🚀 ログイン成功: ${client.user.tag}`);
  console.log('------------------------------');
});

// エラーが起きたら即座にログを出す
process.on('unhandledRejection', error => {
  console.error('❌ 致命的なエラー:', error);
});

// ログイン実行
console.log('Connecting to Discord...');
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ ログインに失敗しました:', err.message);
});
