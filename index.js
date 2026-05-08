const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const axios = require('axios');

http.createServer((req, res) => { res.end('Alive'); }).listen(process.env.PORT || 10000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const processedUrls = new Set();

client.once('ready', () => { console.log(`🚀 最終修正版(検索強化)： ${client.user.tag}`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Spotify(intl-ja対応) & Apple Music
    const musicRegex = /https?:\/\/(?:open\.spotify\.com|music\.apple\.com)\/\S+/i;
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
                const idMatch = inputUrl.match(/[\/=](?:id)?([0-9]+)(?:\?i=([0-9]+))?/);
                const appleId = idMatch ? (idMatch[2] || idMatch[1]) : null;

                if (appleId) {
                    const res = await axios.get(`https://itunes.apple.com/lookup?id=${appleId}&country=jp`);
                    if (res.data.resultCount > 0) {
                        const track = res.data.results[0];
                        // 検索精度を最大にするため「"アーティスト名" 曲名」でSpotify検索URLを作る
                        const query = `"${track.artistName}" ${track.trackName}`;
                        spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
                    }
                }
            } else {
                // 【Spotify → Apple Music】
                spotifyUrl = inputUrl;
                // oEmbedを使ってメタデータを取得
                const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(inputUrl)}`;
                const spotifyRes = await axios.get(oembedUrl);
                
                if (spotifyRes.data && spotifyRes.data.title) {
                    const rawTitle = spotifyRes.data.title; // "Dive to Blue by アイマリン"
                    
                    // 「"アーティスト名" "曲名"」でAppleに完全一致検索を投げる (誤爆防止の肝)
                    const searchTerms = rawTitle.includes(' by ') 
                        ? `"${rawTitle.split(' by ')[1]}" "${rawTitle.split(' by ')[0]}"`
                        : rawTitle;

                    const itunesRes = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerms)}&country=jp&limit=1&entity=song`);
                    
                    if (itunesRes.data.resultCount > 0) {
                        appleUrl = itunesRes.data.results[0].trackViewUrl;
                    } else {
                        // ヒットしなかった場合、少し条件を緩めて再検索
                        const retryRes = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(rawTitle)}&country=jp&limit=1&entity=song`);
                        if (retryRes.data.resultCount > 0) appleUrl = retryRes.data.results[0].trackViewUrl;
                    }
                }
            }

            await message.suppressEmbeds(true).catch(() => null);
            await message.reply({
                content: `Apple Music：${appleUrl}\nSpotify：${spotifyUrl}`,
                allowedMentions: { repliedUser: false }
            });

        } catch (error) {
            console.error(error.message);
        } finally {
            const reaction = message.reactions.cache.get('👀');
            if (reaction) await reaction.users.remove(client.user.id).catch(() => null);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
