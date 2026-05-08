const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// Render維持用
http.createServer((req, res) => { res.end('Alive'); }).listen(process.env.PORT || 10000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`🚀 本番稼働開始： ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Spotify / Apple Music / YouTube Music のURLを検知
    const musicRegex = /https?:\/\/(open\.spotify\.com|music\.apple\.com|music\.youtube\.com)\/\S+/i;
    const match = message.content.match(musicRegex);

    if (match) {
        const inputUrl = match[0];
        
        try {
            // 1. リアクションで受付確認
            await message.react('🎵');

            // 2. SongwhipのまとめURLを生成
            // APIを通さず、直接このURLを提示することで「解析失敗」を回避します
            const songwhipUrl = `https://songwhip.com/${inputUrl}`;

            // 3. 元の埋め込みを消してチャットをスッキリさせる
            try {
                await message.suppressEmbeds(true);
            } catch (e) {
                console.log("埋め込み削除権限なし");
            }

            // 4. 返信
            await message.reply({
                content: `🎧 **他サービスで聴くならこちら：**\n${songwhipUrl}\n\n※このリンクからApple MusicやSpotifyが選べます。`,
                allowedMentions: { repliedUser: false }
            });

        } catch (error) {
            console.error(error);
        } finally {
            // リアクションを完了のチェックに変更
            await message.reactions.removeAll().catch(() => null);
            await message.react('✅').catch(() => null);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
