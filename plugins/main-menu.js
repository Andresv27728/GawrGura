import fs from 'fs'
import { join } from 'path'
import { xpRange } from '../lib/levelling.js'

const decorations = [
  '✧･ﾟ: *✧･ﾟ: 🦈* :･ﾟ✧ :･ﾟ✧',
  '✿･ﾟ: *✿･ﾟ: 🌊* :･ﾟ✿ :･ﾟ✿',
  '☁︎･ﾟ: *☁︎･ﾟ: 🐟* :･ﾟ☁︎ :･ﾟ☁︎',
  '✦･ﾟ: *✦･ﾟ: 🐚* :･ﾟ✦ :･ﾟ✦',
  '✸･ﾟ: *✸･ﾟ: 💙* :･ﾟ✸ :･ﾟ✸',
]

const textStyles = [
  { greeting: 'ʜᴇʏ~ 🦈', activity: '✨ Actitud increíble', dateText: '🌊 Fecha hoy' },
  { greeting: 'ʜʏᴇᴇ~ 🌊', activity: '🌟 Potencia activa', dateText: '🐚 Día actual' },
  { greeting: 'ʜᴏʟᴀ~ 🐟', activity: '🐬 Gran energía', dateText: '💙 Momento presente' },
  { greeting: 'ʙᴜʙᴀ~ 💙', activity: '☁️ Brilla fuerte', dateText: '✨ Fecha exacta' },
  { greeting: 'ᴛʜᴇᴘᴏᴡᴇʀ~ 🌟', activity: '🌊 Fluidez total', dateText: '🦈 Tiempo actual' },
]

const tags = {
  serbot: '✦ Subs Bot',
  downloader: '✦ Downloaders',
  tools: '✦ Herramientas',
  owner: '✦ Owner',
  info: '✦ Info',
  group: '✦ Grupos',
  search: '✦ Buscadores',
  sticker: '✦ Stickers',
  ia: '✦ Inteligencia Artificial',
}

const defaultMenu = {
  before: `
> %greeting
( *%tipo* )

> ⤿ ¿Qué tal %name? ˎˊ˗
%activity: %uptime ⌇
%dateText: %date

➤ ✐ Puedes personalizar el nombre de tu socket con:
> ✎ ⤿ .setname
> *✐ Y cambiar el banner con:*
> ✎ ⤿ .setbanner

%readmore`.trimStart(),

  header: '\n> *%decoration*\n> *❝ %category ❞*',
  body: '\n> ☄︎ %cmd %islimit %isPremium',
  footer: '',
  after: '\n> ⋆creado por yo soy yo',
}

const handler = async (m, { conn, usedPrefix: _p }) => {
  try {
    const { exp, limit, level } = global.db.data.users[m.sender]
    const { min, xp, max } = xpRange(level, global.multiplier)
    const name = await conn.getName(m.sender)

    const d = new Date(Date.now() + 3600000)
    const locale = 'es'
    const date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })

    const help = Object.values(global.plugins)
      .filter(p => !p.disabled)
      .map(plugin => ({
        help: Array.isArray(plugin.help) ? plugin.help : [plugin.help],
        tags: Array.isArray(plugin.tags) ? plugin.tags : [plugin.tags],
        prefix: 'customPrefix' in plugin,
        limit: plugin.limit,
        premium: plugin.premium,
      }))

    let nombreBot = global.namebot || 'Bot'
    let bannerFinal = 'https://files.catbox.moe/qifsi4.jpg' // ✅ Usa esta imagen desde internet

    const botActual = conn.user?.jid?.split('@')[0].replace(/\D/g, '')
    const configPath = join('./JadiBots', botActual, 'config.json')

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath))
        if (config.name) nombreBot = config.name
        if (config.banner) bannerFinal = config.banner
      } catch (err) {
        console.log('⚠️ No se pudo leer config del subbot:', err)
      }
    }

    const tipo = botActual === '+50764735869'.replace(/\D/g, '')
      ? 'Principal 🅥'
      : 'Sub Bot 🅑'

    const menuConfig = conn.menu || defaultMenu

    let sentMessageID = null
    while (true) {
      const randomDecoration = decorations[Math.floor(Math.random() * decorations.length)]
      const randomTextStyle = textStyles[Math.floor(Math.random() * textStyles.length)]

      const _text = [
        menuConfig.before,
        ...Object.keys(tags).map(tag => {
          return [
            menuConfig.header
              .replace(/%category/g, tags[tag])
              .replace(/%decoration/g, randomDecoration),
            help.filter(menu => menu.tags?.includes(tag)).map(menu =>
              menu.help.map(helpText =>
                menuConfig.body
                  .replace(/%cmd/g, menu.prefix ? helpText : `${_p}${helpText}`)
                  .replace(/%islimit/g, menu.limit ? '◜⭐◞' : '')
                  .replace(/%isPremium/g, menu.premium ? '◜🪪◞' : '')
                  .trim()
              ).join('\n')
            ).join('\n'),
            menuConfig.footer,
          ].join('\n')
        }),
        menuConfig.after,
      ].join('\n')

      const replace = {
        '%': '%',
        p: _p,
        botname: nombreBot,
        taguser: '@' + m.sender.split('@')[0],
        exp: exp - min,
        maxexp: xp,
        totalexp: exp,
        xp4levelup: max - exp,
        level,
        limit,
        name,
        date,
        uptime: clockString(process.uptime() * 1000),
        tipo,
        readmore: readMore,
        greeting: randomTextStyle.greeting,
        activity: randomTextStyle.activity,
        dateText: randomTextStyle.dateText,
      }

      const text = _text.replace(
        new RegExp(`%(${Object.keys(replace).sort((a, b) => b.length - a.length).join('|')})`,
