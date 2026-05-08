const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const axios = require('axios');

// サーバー維持用
http.createServer((req, res) => { res.end('Bot is running'); }).listen(process.env.PORT || 10000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 重複実行を「メッセージID」で完全にブロック
const lastProcessedMessageId = new Set();

client.once('ready', () => {
    console.log(`🚀 ログイン完了: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    // Bot自身の発言、または既に処理済みのメッセージIDなら無視
    if (message.author.bot || lastProcessedMessageId.has(message.id)) return;

    const musicRegex = /https?:\/\/(?:open\.spotify\.com|music\.apple\.com)\/\S+/i;
    const match = message.content.match(musicRegex);

    if (match) {
        // 処理開始時にIDを記録（二重反応防止）
        lastProcessedMessageId.add(message.id);
        setTimeout(() => lastProcessedMessageId.delete(message.id), 10000);

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
                        // Spotify検索URL（精度を上げるため、アーティスト名をダブルクォーテーションで囲む）
                        spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent('"' + track.artistName + '" ' + track.trackName)}`;
                    }
                }
            } else {
                // 【Spotify → Apple Music】
                spotifyUrl = inputUrl;
                const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(inputUrl)}`;
                const spotifyRes = await axios.get(oembedUrl);
                
                if (spotifyRes.data && spotifyRes.data.title) {
                    const rawTitle = spotifyRes.data.title; // 例: "Dive to Blue by アイマリン"
                    const parts = rawTitle.split(' by ');
                    const targetArtist = parts[1] ? parts[1].trim() : "";
                    const targetTrack = parts[0] ? parts[0].trim() : "";

                    // iTunes APIで15件取得し、Bot側で「アーティスト名」を厳密に照合
                    const itunesRes = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(rawTitle)}&country=jp&limit=15&entity=song`);
                    
                    if (itunesRes.data.resultCount > 0) {
                        // 取得したリストから、アーティスト名が「アイマリン」と一致するものを1件だけ探す
                        const bestMatch = itunesRes.data.results.find(res => {
                            const apiArtist = res.artistName.toLowerCase();
                            const userArtist = targetArtist.toLowerCase();
                            // アーティスト名が完全一致、または相互に含んでいるか
                            return apiArtist.includes(userArtist) || userArtist.includes(apiArtist);
                        });

                        if (bestMatch) {
                            appleUrl = bestMatch.trackViewUrl;
                        } else {
                            appleUrl = '見つかりませんでした（アーティスト不一致）';
                        }
                    }
                }
            }

            // 元の埋め込みを消す
            await message.suppressEmbeds(true).catch(() => null);

            // 指定形式で出力
            await message.reply({
                content: `Apple Music：${appleUrl}\nSpotify：${spotifyUrl}`,
                allowedMentions: { repliedUser: false }
            });

        } catch (error) {
            console.error('Error:', error.message);
        } finally {
            // リアクション解除
            const reaction = message.reactions.cache.get('👀');
            if (reaction) await reaction.users.remove(client.user.id).catch(() => null);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
