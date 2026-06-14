import fetch from 'node-fetch'
import ytdl from 'yt-direct'

let handler = async (m, { conn, usedPrefix, command, text }) => {
  if (!text) return m.reply(`🦈 *¡Eh buba~! Ingresa algo para buscar en YouTube desu~*\n🌊 *Ejemplo:* ${usedPrefix + command} Gawr Gura`)

  try {
    m.react('🕒')
    // 🔍 Buscar video con Delirius API
    let searchRes = await fetch(`https://delirius-apiofc.vercel.app/search/ytsearch?q=${encodeURIComponent(text)}`)
    let search = await searchRes.json()

    if (!search.data || !search.data.length) return m.reply('❌ *Awww~ No encontré nada buba~.*')

    let result = search.data[0]

    // 🧾 Mostrar info del video con decoración aleatoria
    const decorations = [
      `✨ *「𝘼𝙦𝙪𝙞́ 𝙩𝙚𝙣𝙚𝙢𝙤𝙨 𝙗𝙪𝙗𝙖!」*\n\n`,
      `🌊 *「¡Hiii~ Esto es lo que encontré desu~!」*\n\n`,
      `🌟 *「Mira buba~ ¡Aquí está!」*\n\n`,
      `🦈 *「¡Tiburón trabajando, aquí está tu resultado!」*\n\n`,
      `💙 *「¡Esto es para ti, buba~!」*\n\n`
    ]
    const randomDecoration = decorations[Math.floor(Math.random() * decorations.length)]
    let info = `${randomDecoration}` +
               `🦈 *Título:* ${result.title}\n` +
               `🌊 *Canal:* ${result.author?.name || 'Desconocido'}\n` +
               `⏳ *Duración:* ${result.duration || 'Desconocida'}\n` +
               `👁️ *Vistas:* ${result.views || 'Desconocidas'}\n` +
               `📅 *Publicado:* ${result.publishedAt || 'Desconocida'}\n` +
               `🔗 *Link:* ${result.url}`

    if (result.image) {
      await conn.sendMessage(m.chat, { image: { url: result.image }, caption: info }, { quoted: m })
    } else {
      await m.reply(info)
    }

    // 🎧 Descargar audio con yt-direct
    const audio = await ytdl(result.url, {
      quality: 'audio',
      filter: 'audioonly'
    })

    const chunks = [];
    for await (const chunk of audio.stream()) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // 🎤 Enviar como nota de voz
    await conn.sendMessage(m.chat, {
      audio: buffer,
      mimetype: 'audio/mpeg',
      fileName: 'audio.mp3',
      ptt: true
    }, { quoted: m })

    m.react('✅')

  } catch (e) {
    console.error(e)
    m.reply(`❌ *Gyaa~ Algo salió mal desu~: ${e.message}*`)
    await m.react('✖️')
  }
}

handler.command = ['ytbuscar', 'ytsearch']
export default handler
