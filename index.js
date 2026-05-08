const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const axios = require('axios');

http.createServer((req, res) => { res.end('Alive'); }).listen(process.env.PORT || 10000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', () => { console.log(`🚀 厳密検索モード稼働中： ${client.user.tag}`); });

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

            if (inputUrl.includes('apple.com')) {
                // 【Apple Music → Spotify】
                appleUrl = inputUrl;
                const appleIdMatch = inputUrl.match(/id[p|i]?=?([0-9]+)/);
                if (appleIdMatch) {
                    const itunesSearch = await axios.get(`https://itunes.apple.com/lookup?id=${appleIdMatch[1]}&country=jp`);
                    if (itunesSearch.data.resultCount > 0) {
                        const track = itunesSearch.data.results[0];
                        // 曲名とアーティスト名を組み合わせてSpotify検索URLを生成（精度UP）
                        const query = `${track.trackName} ${track.artistName}`;
                        spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
                    }
                }
            } else if (inputUrl.includes('spotify.com')) {
                // 【Spotify → Apple Music】
                spotifyUrl = inputUrl;
                const embedUrl = `https://open.spotify.com/oembed?url=${inputUrl}`;
                const spotifyRes = await axios.get(embedUrl);
                
                if (spotifyRes.data && spotifyRes.data.title) {
                    // SpotifyのoEmbedから "曲名 by アーティスト名" を取得
                    const rawTitle = spotifyRes.data.title; // 例: "Dive to Blue by アイマリン"
                    const parts = rawTitle.split(' by ');
                    const trackName = parts[0];
                    const artistName = parts[1];

                    // iTunes APIで検索（精度を上げるためにアーティスト名も含める）
                    const itunesSearch = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(rawTitle)}&country=jp&limit=5&entity=song`);
                    
                    if (itunesSearch.data.resultCount > 0) {
                        // 検索結果の中から、アーティスト名が一致するものを探す（誤爆防止）
                        const bestMatch = itunesSearch.data.results.find(res => 
                            res.artistName.includes(artistName) || artistName.includes(res.artistName)
                        ) || itunesSearch.data.results[0];
                        
                        appleUrl = bestMatch.trackViewUrl;
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
            await message.reply(`Apple Music：見つかりませんでした\nSpotify：見つかりませんでした`).catch(() => null);
        } finally {
            const reaction = message.reactions.cache.get('👀');
            if (reaction) await reaction.users.remove(client.user.id).catch(() => null);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
