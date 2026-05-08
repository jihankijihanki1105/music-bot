const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const axios = require('axios');

http.createServer((req, res) => { res.end('Alive'); }).listen(process.env.PORT || 10000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// 重複実行を「メッセージID」で物理的に止める
const processedMessages = new Set();

client.once('ready', () => { console.log(`🚀 鉄壁モード稼働開始： ${client.user.tag}`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const musicRegex = /https?:\/\/(?:open\.spotify\.com|music\.apple\.com)\/\S+/i;
    const match = message.content.match(musicRegex);

    if (match) {
        // 同じメッセージには1回しか反応させない
        if (processedMessages.has(message.id)) return;
        processedMessages.add(message.id);
        setTimeout(() => processedMessages.delete(message.id), 10000);

        const inputUrl = match[0];
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
                        // Spotify検索URL（アーティスト名を最優先）
                        spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(track.artistName + " " + track.trackName)}`;
                    }
                }
            } else {
                // 【Spotify → Apple Music】
                spotifyUrl = inputUrl;
                const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(inputUrl)}`;
                const spotifyRes = await axios.get(oembedUrl);
                
                if (spotifyRes.data && spotifyRes.data.title) {
                    const rawTitle = spotifyRes.data.title; // "Dive to Blue by アイマリン"
                    const parts = rawTitle.split(' by ');
                    const targetArtist = parts[1] ? parts[1].trim() : "";

                    // iTunes APIで15件取得して、Bot側で「アーティスト名」を厳密チェック
                    const itunesRes = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(rawTitle)}&country=jp&limit=15&entity=song`);
                    
                    if (itunesRes.data.resultCount > 0) {
                        // ここで「ラルク」を徹底排除。取得した15件の中からアーティスト名が一致するものだけを探す
                        const bestMatch = itunesRes.data.results.find(res => {
                            const apiArtist = res.artistName.toLowerCase();
                            const userArtist = targetArtist.toLowerCase();
                            // アーティスト名が「含まれている」または「含んでいる」か厳密に判定
                            return apiArtist.includes(userArtist) || userArtist.includes(apiArtist);
                        });

                        if (bestMatch) {
                            appleUrl = bestMatch.trackViewUrl;
                        } else {
                            appleUrl = '見つかりませんでした（アーティストが一致しません）';
                        }
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
