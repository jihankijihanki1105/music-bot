const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const axios = require('axios');

http.createServer((req, res) => { res.end('Alive'); }).listen(process.env.PORT || 10000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', () => { console.log(`🚀 稼働開始： ${client.user.tag}`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // URL検知（Spotify, Apple Music, YouTube Music）
    const musicRegex = /https?:\/\/(open\.spotify\.com|music\.apple\.com|music\.youtube\.com)\/\S+/i;
    const match = message.content.match(musicRegex);

    if (match) {
        const inputUrl = match[0];
        try {
            await message.react('👀');

            let appleUrl = '見つかりませんでした';
            let spotifyUrl = '見つかりませんでした';

            // 1. まずは入力されたURLがどこのものか判別して保持
            if (inputUrl.includes('apple.com')) appleUrl = inputUrl;
            if (inputUrl.includes('spotify.com')) spotifyUrl = inputUrl;

            // 2. iTunes API (Apple公式) を使って検索
            // これにより、Spotifyリンクが貼られた時にApple Musicリンクを探せます
            const itunesSearch = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(inputUrl)}&country=jp&limit=1`);
            
            if (itunesSearch.data.resultCount > 0) {
                const track = itunesSearch.data.results[0];
                if (appleUrl === '見つかりませんでした') appleUrl = track.trackViewUrl || track.collectionViewUrl;
                
                // Spotifyが見つからない場合、曲名とアーティスト名でSpotifyの検索リンクを生成
                if (spotifyUrl === '見つかりませんでした') {
                    const query = encodeURIComponent(`${track.trackName} ${track.artistName}`);
                    spotifyUrl = `https://open.spotify.com/search/${query}`;
                }
            }

            // 万が一どちらも不明な場合の最終バックアップ（検索URL化）
            if (appleUrl === '見つかりませんでした') appleUrl = `https://music.apple.com/jp/search?term=${encodeURIComponent(inputUrl)}`;

            // 3. 元の埋め込みを削除
            await message.suppressEmbeds(true).catch(() => null);

            // 4. 指定形式で返信
            await message.reply({
                content: `Apple Music：${appleUrl}\nSpotify：${spotifyUrl}`,
                allowedMentions: { repliedUser: false }
            });

        } catch (error) {
            console.error('Error:', error.message);
            await message.reply('❌ リンクの解析に失敗しました。');
        } finally {
            const reaction = message.reactions.cache.get('👀');
            if (reaction) await reaction.users.remove(client.user.id).catch(() => null);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
