let activeIntervals = {}

const handler = async (m, { conn, args, command, isAdmin }) => {
  const chatId = m.chat

  // Verificar si el usuario que ejecuta el comando es administrador
  if (!isAdmin) {
    conn.reply(chatId, '❌ Solo los administradores del grupo pueden usar este comando.', m)
    return
  }

  if (command === 'startauto') {
    // Validar parámetros
    if (args.length < 2) {
      conn.reply(chatId, '❌ Uso incorrecto. Debes proporcionar el intervalo en segundos y el mensaje.\nEjemplo: .startauto 10 Este es un mensaje automático.', m)
      return
    }

    const interval = parseInt(args[0])
    if (isNaN(interval) || interval <= 0) {
      conn.reply(chatId, '❌ El intervalo debe ser un número mayor a 0.', m)
      return
    }

    const message = args.slice(1).join(' ')
    if (!message) {
      conn.reply(chatId, '❌ Debes proporcionar un mensaje para enviar automáticamente.', m)
      return
    }

    // Verificar si ya existe un intervalo activo en el chat
    if (activeIntervals[chatId]) {
      conn.reply(chatId, '⚠️ Ya hay un mensaje automático activo en este chat. Detén el actual con .stopauto antes de iniciar uno nuevo.', m)
      return
    }

    // Configurar la cuenta regresiva y el intervalo
    let remainingTime = interval
    let countdownMessageId

    const updateCountdown = async () => {
      const countdownText = `⏳ Próximo mensaje en: ${remainingTime} segundos`
      if (countdownMessageId) {
        // Editar el mensaje de cuenta regresiva
        try {
          await conn.modifyMessage(chatId, countdownMessageId, { text: countdownText })
        } catch (e) {
          console.warn('No se pudo editar el mensaje de cuenta regresiva:', e)
        }
      } else {
        // Enviar el mensaje inicial de cuenta regresiva
        const response = await conn.sendMessage(chatId, { text: countdownText }, { quoted: m })
        countdownMessageId = response.key.id
      }
    }

    // Iniciar el intervalo para enviar el mensaje automáticamente
    activeIntervals[chatId] = setInterval(async () => {
      // Enviar el mensaje automático
      await conn.reply(chatId, message)

      // Reiniciar la cuenta regresiva
      remainingTime = interval
    }, interval * 1000)

    // Iniciar un intervalo separado para actualizar la cuenta regresiva
    const countdownInterval = setInterval(async () => {
      if (remainingTime <= 1) {
        // Detener la cuenta regresiva cuando llegue a 0 (será manejada por el otro intervalo)
        remainingTime = interval
      } else {
        remainingTime--
        await updateCountdown()
      }
    }, 1000)

    // Guardar ambos intervalos en el objeto de intervalos activos
    activeIntervals[chatId] = { messageInterval: activeIntervals[chatId], countdownInterval }

    conn.reply(chatId, `✅ Mensaje automático iniciado. Se enviará cada ${interval} segundos.\nMensaje: ${message}`, m)
  } else if (command === 'stopauto') {
    // Detener el intervalo activo en el chat
    if (!activeIntervals[chatId]) {
      conn.reply(chatId, '⚠️ No hay mensajes automáticos activos en este chat.', m)
      return
    }

    // Limpiar ambos intervalos
    clearInterval(activeIntervals[chatId].messageInterval)
    clearInterval(activeIntervals[chatId].countdownInterval)
    delete activeIntervals[chatId]
    conn.reply(chatId, '✅ Mensaje automático detenido.', m)
  }
}

handler.help = ['startauto', 'stopauto']
handler.tags = ['tools']
handler.command = ['startauto', 'stopauto'] // Comandos asociados
handler.group = false // Solo se puede usar en grupos

export default handler
