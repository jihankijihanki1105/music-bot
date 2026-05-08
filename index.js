const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const axios = require('axios');

http.createServer((req, res) => { res.end('Alive'); }).listen(process.env.PORT || 10000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`🚀 準備完了！ ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const musicRegex = /https?:\/\/(open\.spotify\.com|music\.apple\.com|music\.youtube\.com)\/\S+/i;
    const match = message.content.match(musicRegex);

    if (match) {
        const inputUrl = match[0];
        try {
            await message.react('👀');

            // Songwhip APIへのリクエスト (ヘッダーを追加して安定性を向上)
            const response = await axios.post('https://songwhip.com/api/get', 
                { url: inputUrl },
                { 
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                }
            );

            const data = response.data;

            // データの存在チェック
            if (!data || !data.links) {
                return message.reply('🔍 楽曲データは見つかりましたが、配信サイトのリンクが取得できませんでした。');
            }

            // リンクの抽出 (?. を使ってエラーを防ぐ)
            const spotify = data.links.spotify?.[0]?.link || '配信なし';
            const apple = data.links.itunes?.[0]?.link || '配信なし';

            // 両方見つからない場合
            if (spotify === '配信なし' && apple === '配信なし') {
                return message.reply('❌ 対応するSpotify/Apple Musicのリンクが見つかりませんでした。');
            }

            // 元の埋め込みを削除
            try {
                await message.suppressEmbeds(true);
            } catch (e) {
                console.log("埋め込み削除失敗（権限不足など）");
            }

            // 返信
            await message.reply({
                content: `🍎 **Apple Music：** ${apple}\n🎧 **Spotify：** ${spotify}`,
                allowedMentions: { repliedUser: false }
            });

        } catch (error) {
            console.error('API Error:', error.response?.data || error.message);
            await message.reply('❌ 解析に失敗しました。Songwhipが混み合っているか、未登録の楽曲です。');
        } finally {
            const reaction = message.reactions.cache.get('👀');
            if (reaction) await reaction.users.remove(client.user.id).catch(() => null);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
