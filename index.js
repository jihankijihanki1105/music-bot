const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const axios = require('axios');

http.createServer((req, res) => { res.end('Alive'); }).listen(process.env.PORT || 10000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', () => { console.log(`🚀 相互変換(修正版)稼働中： ${client.user.tag}`); });

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
                const appleIdMatch = inputUrl.match(/id[p|i]?=?([0-9]+)/);
                if (appleIdMatch) {
                    const itunesSearch = await axios.get(`https://itunes.apple.com/lookup?id=${appleIdMatch[1]}&country=jp`);
                    if (itunesSearch.data.resultCount > 0) {
                        const track = itunesSearch.data.results[0];
                        searchTerms = `${track.trackName} ${track.artistName}`;
                        spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(searchTerms)}`;
                    }
                }
            } else if (inputUrl.includes('spotify.com')) {
                // 【Spotify → Apple Music】
                spotifyUrl = inputUrl;
                
                // SpotifyのメタデータをAPIなしで取得できるツールを利用して曲名を特定
                const embedUrl = `https://open.spotify.com/oembed?url=${inputUrl}`;
                try {
                    const spotifyRes = await axios.get(embedUrl);
                    if (spotifyRes.data && spotifyRes.data.title) {
                        // "TrackName by ArtistName" の形式で返ってくるのでこれを使う
                        searchTerms = spotifyRes.data.title;
                    }
                } catch (e) {
                    // oembedがダメな場合はURLから情報を推測（最終手段）
                    console.log("oembed failed, using fallback search");
                }

                if (searchTerms) {
                    // iTunes APIで楽曲を検索
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
            await message.reply(`Apple Music：見つかりませんでした\nSpotify：見つかりませんでした`).catch(() => null);
        } finally {
            const reaction = message.reactions.cache.get('👀');
            if (reaction) await reaction.users.remove(client.user.id).catch(() => null);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
