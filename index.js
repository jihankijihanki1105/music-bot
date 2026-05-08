const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const axios = require('axios');

http.createServer((req, res) => { res.end('Alive'); }).listen(process.env.PORT || 10000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const processedUrls = new Set();

client.once('ready', () => { console.log(`🚀 URL解析強化版稼働中： ${client.user.tag}`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const musicRegex = /https?:\/\/(open\.spotify\.com|music\.apple\.com)\/\S+/i;
    const match = message.content.match(musicRegex);

    if (match) {
        const inputUrl = match[0];

        if (processedUrls.has(inputUrl)) return;
        processedUrls.add(inputUrl);
        setTimeout(() => processedUrls.delete(inputUrl), 5000);

        try {
            await message.react('👀');

            let appleUrl = '見つかりませんでした';
            let spotifyUrl = '見つかりませんでした';

            if (inputUrl.includes('apple.com')) {
                // 【Apple Music → Spotify】
                appleUrl = inputUrl;
                
                // URLからIDを抽出するロジックを強化
                // 「/i=」の後ろの数字、または「/id」の後ろの数字を探す
                const idMatch = inputUrl.match(/[\/=](?:id)?([0-9]+)(?:\?i=([0-9]+))?/);
                const appleId = idMatch ? (idMatch[2] || idMatch[1]) : null;

                if (appleId) {
                    const itunesSearch = await axios.get(`https://itunes.apple.com/lookup?id=${appleId}&country=jp`);
                    if (itunesSearch.data.resultCount > 0) {
                        const track = itunesSearch.data.results[0];
                        // Spotify検索リンクを「曲名 + アーティスト名」で確実に生成
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
                    const rawTitle = spotifyRes.data.title; 
                    const itunesSearch = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(rawTitle)}&country=jp&limit=10&entity=song`);
                    
                    if (itunesSearch.data.resultCount > 0) {
                        const artistKey = rawTitle.includes(' by ') ? rawTitle.split(' by ')[1] : "";
                        const bestMatch = itunesSearch.data.results.find(res => 
                            artistKey && (res.artistName.includes(artistKey) || artistKey.includes(res.artistName))
                        ) || itunesSearch.data.results[0];
                        
                        appleUrl = bestMatch.trackViewUrl;
                    }
                }
            }

            await message.suppressEmbeds(true).catch(() => null);

            await message.reply({
                content: `Apple Music：${appleUrl}\nSpotify：${spotifyUrl}`,
                allowedMentions: { repliedUser: false }
            });

        } catch (error) {
            console.error('Error:', error.message);
        } finally {
            const reaction = message.reactions.cache.get('👀');
            if (reaction) await reaction.users.remove(client.user.id).catch(() => null);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
