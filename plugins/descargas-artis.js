import fetch from "node-fetch";
import ytdl from 'yt-direct';

// Variable global para evitar procesos concurrentes en el comando .artista
let isDownloadingArtist = false;

// Función auxiliar que descarga un audio a partir de una URL de YouTube
async function downloadTrack(youtubeUrl) {
  try {
    const audio = await ytdl(youtubeUrl, {
      quality: 'audio',
      filter: 'audioonly'
    });

    const chunks = [];
    for await (const chunk of audio.stream()) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    return { audioBuffer, title: audio.title };
  } catch (error) {
    throw error;
  }
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  // Se activa únicamente con el comando .artista
  if (command.toLowerCase() !== "artista") return;

  // Si ya hay una descarga en curso, se responde con un mensaje enojado
  if (isDownloadingArtist) {
    return conn.sendMessage(m.chat, { text: "⚠️ ¡Ya hay una descarga en curso! No interrumpas el proceso." });
  }
  
  // Validar que se haya proporcionado el nombre del artista
  if (!text || text.trim().length === 0) {
    return conn.sendMessage(m.chat, { text: `⚠️ *¡Atención!*\n\n💡 Debes proporcionar el nombre del artista.\n📌 Ejemplo: ${usedPrefix}artista TWICE` });
  }

  isDownloadingArtist = true;
  m.react('🕒');
  
  // Aviso inicial
  await conn.sendMessage(m.chat, { text: "🔔 *Iniciando descarga de música por artista.*\n\n⏳ Por favor, no interrumpas el proceso." });
  
  // Consultar la API de búsqueda por artista
  const searchUrl = `https://delirius-apiofc.vercel.app/search/searchtrack?q=${encodeURIComponent(text)}`;
  let searchResults;
  try {
    const response = await fetch(searchUrl);
    searchResults = await response.json();
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      isDownloadingArtist = false;
      return conn.sendMessage(m.chat, { text: "⚠️ No se encontraron resultados para ese artista." });
    }
  } catch (error) {
    isDownloadingArtist = false;
    return conn.sendMessage(m.chat, { text: `❌ *Error al buscar música:* ${error.message || "Desconocido"}` });
  }
  
  // Limitar a máximo 10 canciones
  const tracks = searchResults.slice(0, 10);
  
  // Descargar y enviar cada track de forma secuencial (uno a uno)
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    try {
      // Descargar el track y enviar inmediatamente para liberar recursos
      const { audioBuffer, title } = await downloadTrack(track.url);
      await conn.sendMessage(m.chat, {
        document: audioBuffer,
        mimetype: "audio/mpeg",
        fileName: `${title}.mp3`,
        caption: `🎶 *${track.title}*\n👤 *Artista:* ${track.artist}\n💽 *Álbum:* ${track.album || "Desconocido"}`
      }, { quoted: m });
      // Pequeña pausa para liberar recursos antes de la siguiente descarga
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      // Si falla la descarga de un track, se omite (solo se registra en consola)
      console.error(`Error al descargar "${track.title}":`, error);
      continue;
    }
  }
  
  isDownloadingArtist = false;
  m.react('✅');
  await conn.sendMessage(m.chat, { text: "✅ *Descargas Finalizadas Exitosamente.*" });
};

handler.command = /^artista$/i;

export default handler;
handler.tags = ['downloader']
