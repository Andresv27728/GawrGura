import fetch from 'node-fetch';
import ytdl from 'yt-direct';
import yts from 'yt-search';

// Lista de API keys de búsqueda (opcional, para yt-search backup)
const API_KEYS = [
  'AIzaSyA3-PRUEBA3',
  'AIzaSyA4-PRUEBA4',
  'AIzaSyA5-PRUEBA5',
  'AIzaSyA6-PRUEBA6',
  'AIzaSyA7-PRUEBA7',
  'AIzaSyA8-PRUEBA8',
  'AIzaSyA9-PRUEBA9',
  'AIzaSyA10-PRUEBA10'
];

function getRandomApiKey() {
  return API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
}

const handler = async (m, { conn, args, usedPrefix }) => {
  if (!args[0]) {
    return conn.reply(m.chat, `✏️ Ingresa un título para buscar en YouTube.\n\nEjemplo:\n> ${usedPrefix}play Corazón Serrano - Mix Poco Yo`, m);
  }

  m.react('🕒');

  try {
    let videoInfo;
    const query = args.join(" ");

    // 1️⃣ Intentar búsqueda con YouTube Data API (opcional) o yt-search
    try {
      const API_KEY = getRandomApiKey();
      const searchURL = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${API_KEY}`;
      const res = await fetch(searchURL);
      const data = await res.json();

      if (data.items && data.items.length) {
        const video = data.items[0];
        videoInfo = {
          title: video.snippet.title,
          url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
          thumbnail: video.snippet.thumbnails.high.url
        };
      } else {
        throw new Error('Sin resultados API oficial');
      }
    } catch (err) {
      const results = await yts(query);
      if (!results.videos.length) throw new Error('No se encontraron resultados');
      const video = results.videos[0];
      videoInfo = {
        title: video.title,
        url: video.url,
        thumbnail: video.thumbnail
      };
    }

    // 2️⃣ Descargar con yt-direct (mejor calidad de audio)
    const audio = await ytdl(videoInfo.url, {
      quality: 'audio',
      filter: 'audioonly'
    });

    // 3️⃣ Enviar información con miniatura
    const caption = `🎥 *Video encontrado*\n📌 *Título:* ${videoInfo.title}\n🔗 *Enlace:* ${videoInfo.url}`;
    await conn.sendMessage(m.chat, {
      image: { url: videoInfo.thumbnail },
      caption: caption
    }, { quoted: m });

    // 4️⃣ Enviar audio (Buffer para evitar problemas de IP binding)
    const chunks = [];
    for await (const chunk of audio.stream()) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    await conn.sendMessage(m.chat, {
      audio: buffer,
      mimetype: 'audio/mpeg',
      fileName: `${videoInfo.title}.mp3`
    }, { quoted: m });

    m.react('✅');

  } catch (e) {
    console.error(e);
    conn.reply(m.chat, `❗ Ocurrió un error: ${e.message}`, m);
    m.react('❌');
  }
};

handler.help = ['play'];
handler.tags = ['descargas'];
handler.command = ['play'];

export default handler;
