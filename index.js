const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const axios = require('axios');

http.createServer((req, res) => { res.end('Alive'); }).listen(process.env.PORT || 10000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', () => { console.log(`🚀 相互変換モード稼働中： ${client.user.tag}`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const musicRegex = /https?:\/\/(open\.spotify\.com|music\.apple\.com)\/\S+/i;
    const match = message.content.match(musicRegex);

    if (match) {
        const inputUrl = match[0];
        try {
            await message.react('👀');

            let appleUrl = '見つかりませんでした';
            let spotifyUrl = '見つかりませんでした';
            let searchTerms = "";

            if (inputUrl.includes('apple.com')) {
                // 【Apple Music → Spotify】
                appleUrl = inputUrl;
                const itunesSearch = await axios.get(`https://itunes.apple.com/lookup?url=${encodeURIComponent(inputUrl)}&country=jp`);
                if (itunesSearch.data.resultCount > 0) {
                    const track = itunesSearch.data.results[0];
                    searchTerms = `${track.trackName} ${track.artistName}`;
                    // SpotifyはUPC検索URLで直リンクに近い精度を出す
                    spotifyUrl = track.upc ? `https://open.spotify.com/search/upc:${track.upc}` : `https://open.spotify.com/search/${encodeURIComponent(searchTerms)}`;
                }
            } else if (inputUrl.includes('spotify.com')) {
                // 【Spotify → Apple Music】
                spotifyUrl = inputUrl;
                // Spotifyのページから曲名を抽出（API認証なしで情報を取るための工夫）
                const res = await axios.get(inputUrl);
                const titleMatch = res.data.match(/<title>(.*?)<\/title>/i);
                if (titleMatch) {
                    // 「曲名 - アーティスト名 - song by...」のようなタイトルから検索ワードを作成
                    searchTerms = titleMatch[1].split('|')[0].split(' - Spotify')[0].trim();
                }

                if (searchTerms) {
                    const itunesSearch = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerms)}&country=jp&limit=1&entity=song`);
                    if (itunesSearch.data.resultCount > 0) {
                        appleUrl = itunesSearch.data.results[0].trackViewUrl;
                    }
                }
            }

            // 元の埋め込みを削除
            await message.suppressEmbeds(true).catch(() => null);

            // 指定形式で返信
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
