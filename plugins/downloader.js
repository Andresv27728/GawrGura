import ytdl from 'yt-direct'
import fs from 'fs'
import path from 'path'

let handler = async (m, { conn, text, usedPrefix, command, args }) => {
  try {
    if (!text) {
      return conn.reply(m.chat, `*Por favor, ingresa la URL del vídeo de YouTube.*`, m)
    }

    if (!/^(?:https?:\/\/)?(?:www\.|m\.|music\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|\/)([\w\-_]+)\&?/.test(args[0])) {
      return m.reply(`*⚠️ Enlace inválido, por favor coloca un enlace válido de YouTube.*`)
    }

    m.react('🕒')

    const video = await ytdl(args[0], {
      quality: 'best',
      format: 'mp4',
      filter: 'audioandvideo'
    })

    // Leer el nombre del subbot como el menú
    const botActual = conn.user?.jid?.split('@')[0].replace(/\D/g, '')
    const configPath = path.join('./JadiBots', botActual, 'config.json')

    let nombreBot = global.namebot || '𝙎𝙃𝙊𝙔𝙊 𝙃𝙄𝙉𝘼𝙏𝘼 ოძ  𝘽 ꂦ Ꮏ'
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        if (config.name) nombreBot = config.name
      } catch (err) {
        console.log('⚠️ No se pudo leer config del subbot:', err)
      }
    }

    const cap = `*${video.title}*\n≡ *🍫 URL:* ${args[0]}\n\n> Send by: ${nombreBot}`

    const chunks = [];
    for await (const chunk of video.stream()) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    await conn.sendFile(m.chat, buffer, `${video.title}.mp4`, cap, m)
    m.react('✅')
  } catch (e) {
    console.error(e)
    m.reply(`Ocurrió un error:\n${e.message}`)
  }
}

handler.help = ['ytmp4doc']
handler.command = ['playvidoc', 'ytmp4']
handler.tags = ['downloader']

export default handler
