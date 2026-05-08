const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const axios = require('axios');

// サーバー維持用：外部からのアクセスを待ち受ける
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is Alive');
}).listen(process.env.PORT || 10000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// 【2回出る問題の解決】メッセージIDで物理的に重複を遮断
const processedMessages = new Set();

client.once('ready', () => { console.log(`🚀 最終検証済み： ${client.user.tag}`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || processedMessages.has(message.id)) return;

    const musicRegex = /https?:\/\/(?:open\.spotify\.com|music\.apple\.com)\/\S+/i;
    const match = message.content.match(musicRegex);

    if (match) {
        processedMessages.add(message.id);
        setTimeout(() => processedMessages.delete(message.id), 60000); // 1分間保持

        const inputUrl = match[0];
        try {
            await message.react('👀');

            let appleUrl = '見つかりませんでした';
            let spotifyUrl = '見つかりませんでした';

            if (inputUrl.includes('apple.com')) {
                // 【Apple Music → Spotify】
                appleUrl = inputUrl;
                // 日本語混じりURLでも確実にIDを抜く
                const idMatch = inputUrl.match(/[\/=](?:id)?([0-9]+)(?:\?i=([0-9]+))?/);
                const appleId = idMatch ? (idMatch[2] || idMatch[1]) : null;

                if (appleId) {
                    const res = await axios.get(`https://itunes.apple.com/lookup?id=${appleId}&country=jp`);
                    if (res.data.resultCount > 0) {
                        const track = res.data.results[0];
                        // Spotify検索URLにアーティスト名を""で囲んで入れる（精度UP）
                        spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent('"' + track.artistName + '" ' + track.trackName)}`;
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
                    const targetTrack = parts[0].trim();
                    const targetArtist = parts[1] ? parts[1].trim() : "";

                    // 【ラルク誤爆対策】20件取得して、Bot側でアーティスト名を「検閲」する
                    const itunesRes = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(targetTrack + " " + targetArtist)}&country=jp&limit=20&entity=song`);
                    
                    if (itunesRes.data.resultCount > 0) {
                        // 検索結果の中からアーティスト名が一致するものだけを厳選
                        const bestMatch = itunesRes.data.results.find(res => {
                            const apiArtist = res.artistName.toLowerCase();
                            const userArtist = targetArtist.toLowerCase();
                            // アイマリン vs アイマリン(CV:内田彩) などの表記ゆれもカバー
                            return apiArtist.includes(userArtist) || userArtist.includes(apiArtist);
                        });

                        if (bestMatch) {
                            appleUrl = bestMatch.trackViewUrl;
                        } else {
                            appleUrl = '見和かりませんでした（アーティスト不一致）';
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
            console.error('Error:', error.message);
        } finally {
            const reaction = message.reactions.cache.get('👀');
            if (reaction) await reaction.users.remove(client.user.id).catch(() => null);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
