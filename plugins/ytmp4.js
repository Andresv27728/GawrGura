import ytdl from 'yt-direct';

let handler = async (m, { conn, text, usedPrefix, command, args }) => {
  try {
    if (!text) {
      return conn.reply(m.chat, `🌱 Ejemplo de uso: ${usedPrefix}${command} https://youtube.com/watch?v=Hx920thF8X4`, m);
    }

    if (!/^(?:https?:\/\/)?(?:www\.|m\.|music\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|\/)([\w\-_]+)\&?/.test(args[0])) {
      return m.reply(`Enlace inválido`);
    }

    m.react('🕒');

    const video = await ytdl(args[0], {
      quality: 'best',
      format: 'mp4',
      filter: 'audioandvideo'
    });

    const cap = `\`\`\`⊜─⌈ 📻 ◜YouTube MP4◞ 📻 ⌋─⊜\`\`\`\n≡ 🌿 \`Title\` : ${video.title}\n≡ 🌲 \`URL\` : ${args[0]}`;

    // Coleccionamos el stream en un buffer para evitar problemas de IP binding y compatibilidad con sendFile
    const chunks = [];
    for await (const chunk of video.stream()) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    await conn.sendFile(m.chat, buffer, `${video.title}.mp4`, cap, m, null, { asDocument: true, mimetype: "video/mp4" });

    m.react('☑️');
  } catch (e) {
    console.error(e);
    m.reply(`Error: ${e.message || e}`);
  }
};

handler.help = ['ytmp4'];
handler.command = ['ytv2', 'ytmp4', 'ytv'];
handler.tags = ['descargas'];
handler.diamond = true;

export default handler;
