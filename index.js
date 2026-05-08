const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// Renderの起動を維持するためだけの最小サーバー
http.createServer((req, res) => res.end('Alive')).listen(process.env.PORT || 10000);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

console.log("--- 診断開始 ---");
console.log("トークンの文字数:", process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.length : "0 (未設定)");

client.once('ready', () => {
  console.log(`✅ 成功！ログインしました: ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.log(`❌ 失敗: ${err.message}`);
});
