const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const axios = require('axios'); // リンク解析用に必要です

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
    console.log(`🚀 準備完了！ ${client.user.tag} で動作中`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const musicRegex = /https?:\/\/(open\.spotify\.com|music\.apple\.com|music\.youtube\.com)\/\S+/i;
    const match = message.content.match(musicRegex);

    if (match) {
        const inputUrl = match[0];
        
        try {
            // 1. 検索中リアクションを付ける
            await message.react('👀');

            // 2. Songwhip APIを使ってリンク情報を取得
            const response = await axios.post('https://songwhip.com/api/get', { url: inputUrl });
            const data = response.data;

            if (!data || !data.links) {
                throw new Error('No links found');
            }

            // 3. Apple MusicとSpotifyのリンクを抽出
            const spotify = data.links.spotify ? data.links.spotify[0].link : '見つかりませんでした';
            const apple = data.links.itunes ? data.links.itunes[0].link : '見つかりませんでした';

            // 4. 元の埋め込みを消す（メッセージから埋め込み機能を外す）
            await message.suppressEmbeds(true);

            // 5. テキスト形式で返信
            await message.reply({
                content: `🍎 **Apple Music：** ${apple}\n🎧 **Spotify：** ${spotify}`,
                allowedMentions: { repliedUser: false }
            });

        } catch (error) {
            console.error(error);
            await message.reply('❌ リンクの解析に失敗しました。対応していない楽曲か、一時的なエラーです。');
        } finally {
            // リアクションを消す（または完了マークに変える）
            const userReactions = message.reactions.cache.filter(reaction => reaction.users.cache.has(client.user.id));
            for (const reaction of userReactions.values()) {
                await reaction.users.remove(client.user.id);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
