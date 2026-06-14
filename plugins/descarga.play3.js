import yts from 'yt-search'
import ytdl from 'yt-direct'

const handler = async (m, { conn, command, text, usedPrefix }) => {
  if (!text) throw `Ejemplo: ${usedPrefix}${command} <su consulta>`

  m.react('🕒')
  const search = await yts(text)
  const vid = search.videos[0]
  if (!vid) throw 'Vídeo no encontrado, por favor prueba con otro título~'

  const { title, thumbnail, timestamp, views, ago, url } = vid

  await conn.sendMessage(m.chat, {
    image: { url: thumbnail },
    caption: `🔍 Encontré la canción: *${title}*\nSe está descargando actualmente...`,
  }, { quoted: m })

  try {
    const audio = await ytdl(url, {
      quality: 'audio',
      filter: 'audioonly'
    })

    const chunks = [];
    for await (const chunk of audio.stream()) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    await conn.sendMessage(m.chat, {
      audio: buffer,
      mimetype: 'audio/mpeg',
      fileName: `${title}.mp3`,
      caption: `*${title}*\n*Duración*: ${timestamp}`,
      contextInfo: {
        externalAdReply: {
          showAdAttribution: true,
          mediaType: 2,
          mediaUrl: url,
          title: title,
          body: 'Audio Download',
          sourceUrl: url,
          thumbnail: await (await conn.getFile(thumbnail)).data,
        },
      },
    }, { quoted: m })

    m.react('✅')

  } catch (error) {
    console.error('Error:', error.message)
    throw `Error al descargar el audio 😢: ${error.message}`
  }
}

handler.help = ['play3'].map(v => v + ' <consulta>')
handler.tags = ['Downloaders']
handler.command = /^(play3)$/i

handler.register = false
handler.disable = false

export default handler
