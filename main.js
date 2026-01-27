process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1';
import './config.js';
import { createRequire } from 'module';
import path, { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { platform } from 'process';
import * as ws from 'ws';
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, watch, mkdirSync } from 'fs';
import yargs from 'yargs';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import { tmpdir } from 'os';
import { format } from 'util';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { makeWASocket, protoType, serialize } from './lib/simple.js';
import { Low, JSONFile } from 'lowdb';
import lodash from 'lodash';
import readline from 'readline';
import NodeCache from 'node-cache';
import qrcode from 'qrcode-terminal';
import { spawn } from 'child_process';

const { proto } = (await import('@whiskeysockets/baileys')).default;
const {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
} = await import('@whiskeysockets/baileys');

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

protoType();
serialize();

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
};
global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true));
};
global.__require = function require(dir = import.meta.url) {
  return createRequire(dir);
};

global.API = (name, path = '/', query = {}, apikeyqueryname) =>
  (name in global.APIs ? global.APIs[name] : name) +
  path +
  (query || apikeyqueryname
    ? '?' +
      new URLSearchParams(
        Object.entries({
          ...query,
          ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}),
        })
      )
    : '');

global.timestamp = { start: new Date() };

const __dirname = global.__dirname(import.meta.url);

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp(
  '^[' +
    (opts['prefix'] || '‎z/#$%.\\-').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') +
    ']'
);

global.db = new Low(new JSONFile(`storage/databases/database.json`));

global.DATABASE = global.db;
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ)
    return new Promise((resolve) =>
      setInterval(async function () {
        if (!global.db.READ) {
          clearInterval(this);
          resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
        }
      }, 1 * 1000)
    );
  if (global.db.data !== null) return;
  global.db.READ = true;
  await global.db.read().catch(console.error);
  global.db.READ = null;
  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    ...(global.db.data || {}),
  };
  global.db.chain = lodash.chain(global.db.data);
};

global.authFile = `sessions`;
const { state, saveCreds } = await useMultiFileAuthState(global.authFile);

const { version } = await fetchLatestBaileysVersion();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (texto) => new Promise((resolver) => rl.question(texto, resolver));

const logger = pino({
  timestamp: () => `,"time":"${new Date().toJSON()}"`,
}).child({ class: 'client' });
logger.level = 'fatal';

const connectionOptions = {
  version: version,
  logger,
  printQRInTerminal: false,
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger),
  },
  browser: Browsers.ubuntu('Chrome'),
  markOnlineOnclientect: false,
  generateHighQualityLinkPreview: true,
  syncFullHistory: true,
  retryRequestDelayMs: 10,
  transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
  maxMsgRetryCount: 15,
  appStateMacVerification: {
    patch: false,
    snapshot: false,
  },
  getMessage: async (key) => {
    const jid = jidNormalizedUser(key.remoteJid);
    const msg = await store.loadMessage(jid, key.id);
    return msg?.message || '';
  },
};

global.conn = makeWASocket(connectionOptions);

/**
 * Función para reconectar un sub-bot y asignarle un manejador de mensajes.
 * @param {string} botPath - Ruta completa a la carpeta de sesión del sub-bot.
 */
async function reconnectSubBot(botPath) {
    console.log(chalk.yellow(`Intentando reconectar sub-bot en: ${path.basename(botPath)}`));
    try {
        const { state: subBotState, saveCreds: saveSubBotCreds } = await useMultiFileAuthState(botPath);
        const subBotConn = makeWASocket({
            version: version,
            logger,
            printQRInTerminal: false,
            auth: {
                creds: subBotState.creds,
                keys: makeCacheableSignalKeyStore(subBotState.keys, logger),
            },
            browser: Browsers.ubuntu('Chrome'),
            markOnlineOnclientect: false,
            generateHighQualityLinkPreview: true,
            syncFullHistory: true,
            retryRequestDelayMs: 10,
            transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
            maxMsgRetryCount: 15,
            appStateMacVerification: {
                patch: false,
                snapshot: false,
            },
            getMessage: async (key) => {
                const jid = jidNormalizedUser(key.remoteJid);
                const msg = await store.loadMessage(jid, key.id);
                return msg?.message || '';
            },
        });

        subBotConn.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log(chalk.green(`Sub-bot conectado correctamente: ${path.basename(botPath)}`));
            } else if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.error(chalk.red(`Sub-bot desconectado en ${path.basename(botPath)}. Razón: ${reason}`));
                // Aquí podrías agregar lógica para reintentar la conexión de este sub-bot si es necesario
            }
        });
        subBotConn.ev.on('creds.update', saveSubBotCreds);

        // ¡IMPORTANTE!: Asignar el manejador de mensajes al sub-bot
        // Asumiendo que 'handler' es el objeto importado de handler.js y contiene la función handler.
        if (handler && handler.handler) {
            subBotConn.handler = handler.handler.bind(subBotConn);
            subBotConn.ev.on('messages.upsert', subBotConn.handler);
            console.log(chalk.blue(`Manejador asignado al sub-bot: ${path.basename(botPath)}`));
        } else {
            console.warn(chalk.yellow(`Advertencia: No se encontró el manejador para asignar al sub-bot: ${path.basename(botPath)}`));
        }

        // Guarda la conexión del sub-bot en un objeto global para acceso futuro si lo necesitas
        if (!global.subBots) {
            global.subBots = {};
        }
        global.subBots[path.basename(botPath)] = subBotConn;
        
    } catch (e) {
        console.error(chalk.red(`Error al reconectar sub-bot en ${path.basename(botPath)}:`), e);
    }
}


async function handleLogin() {
  if (conn.authState.creds.registered) {
    console.log(chalk.green('Sesión ya está registrada.'));
    return;
  }

  let loginMethod = await question(
    chalk.green(
      '¿Cómo deseas iniciar sesión?\nEscribe "qr" para escanear el código QR o "code" para usar un código de 8 dígitos:\n'
    )
  );

  loginMethod = loginMethod.toLowerCase().trim();

  if (loginMethod === 'code') {
    let phoneNumber = await question(chalk.blue('Ingresa el número de WhatsApp donde estará el bot (incluye código país, ej: 521XXXXXXXXXX):\n'));
    phoneNumber = phoneNumber.replace(/\D/g, ''); // Solo números

    // Ajustes básicos para México (52)
    if (phoneNumber.startsWith('52') && phoneNumber.length === 12) {
      phoneNumber = `521${phoneNumber.slice(2)}`;
    } else if (phoneNumber.startsWith('52')) {
      phoneNumber = `521${phoneNumber.slice(2)}`;
    } else if (phoneNumber.startsWith('0')) {
      phoneNumber = phoneNumber.replace(/^0/, '');
    }

    if (typeof conn.requestPairingCode === 'function') {
      try {
        // Validar que la conexión esté abierta antes de solicitar código
        if (conn.ws.readyState === ws.OPEN) {
          let code = await conn.requestPairingCode(phoneNumber);
          code = code?.match(/.{1,4}/g)?.join('-') || code;
          console.log(chalk.cyan('Tu código de emparejamiento es:', code));
        } else {
          console.log(chalk.red('La conexión no está abierta. Intenta nuevamente.'));
        }
      } catch (e) {
        console.log(chalk.red('Error al solicitar código de emparejamiento:'), e.message || e);
      }
    } else {
      console.log(chalk.red('Tu versión de Baileys no soporta emparejamiento por código.'));
    }
  } else {
    console.log(chalk.yellow('Generando código QR, escanéalo con tu WhatsApp...'));
    conn.ev.on('connection.update', ({ qr }) => {
      if (qr) qrcode.generate(qr, { small: true });
    });
  }
}

await handleLogin();

conn.isInit = false;
conn.well = false;

if (!opts['test']) {
  if (global.db) {
    setInterval(async () => {
      if (global.db.data) await global.db.write();
      if (opts['autocleartmp']) {
        const tmp = [tmpdir(), 'tmp', 'serbot'];
        tmp.forEach((filename) => {
          spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']);
        });
      }
    }, 30 * 1000);
  }
}

function clearTmp() {
  const tmp = [join(__dirname, './tmp')];
  const filename = [];
  tmp.forEach((dirname) => readdirSync(dirname).forEach((file) => filename.push(join(dirname, file))));
  return filename.map((file) => {
    const stats = statSync(file);
    if (stats.isFile() && Date.now() - stats.mtimeMs >= 1000 * 60 * 3) return unlinkSync(file);
    return false;
  });
}

setInterval(() => {
  if (global.stopped === 'close' || !conn || !conn.user) return;
  clearTmp();
}, 180000);

async function connectionUpdate(update) {
  const { connection, lastDisconnect, isNewLogin } = update;
  global.stopped = connection;
  if (isNewLogin) conn.isInit = true;
  const code =
    lastDisconnect?.error?.output?.statusCode ||
    lastDisconnect?.error?.output?.payload?.statusCode;
  if (code && code !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
    await global.reloadHandler(true).catch(console.error);
    global.timestamp.connect = new Date();
  }
  if (global.db.data == null) await loadDatabase();
  if (connection === 'open') {
    console.log(chalk.yellow('Conectado correctamente.'));

    // --- Lógica de reconexión de sub-bots al iniciar el bot principal ---
    const rutaJadiBot = join(__dirname, './JadiBots');
    
    if (!existsSync(rutaJadiBot)) {
        mkdirSync(rutaJadiBot, { recursive: true });
        console.log(chalk.bold.cyan(`La carpeta: ${rutaJadiBot} se creó correctamente.`));
    } else {
        console.log(chalk.bold.cyan(`La carpeta: ${rutaJadiBot} ya está creada.`));
    }

    const readRutaJadiBot = readdirSync(rutaJadiBot);
    if (readRutaJadiBot.length > 0) {
        const credsFile = 'creds.json';
        for (const subBotDir of readRutaJadiBot) {
            const botPath = join(rutaJadiBot, subBotDir);
            const readBotPath = readdirSync(botPath);
            if (readBotPath.includes(credsFile)) {
                // Llama a la función para reconectar cada sub-bot
                await reconnectSubBot(botPath);
            }
        }
    }
    // --- Fin de la lógica de reconexión de sub-bots ---

  }
  const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
  if (reason === 405) {
    if (existsSync('./sessions/creds.json')) unlinkSync('./sessions/creds.json');
    console.log(
      chalk.bold.redBright(
        `Conexión reemplazada, por favor espera un momento. Reiniciando...\nSi aparecen errores, vuelve a iniciar con: npm start`
      )
    );
    process.send('reset');
  }
  if (connection === 'close') {
    switch (reason) {
      case DisconnectReason.badSession:
        conn.logger.error(`Sesión incorrecta, elimina la carpeta ${global.authFile} y escanea nuevamente.`);
        break;
      case DisconnectReason.connectionClosed:
      case DisconnectReason.connectionLost:
      case DisconnectReason.timedOut:
        conn.logger.warn(`Conexión perdida o cerrada, reconectando...`);
        await global.reloadHandler(true).catch(console.error);
        break;
      case DisconnectReason.connectionReplaced:
        conn.logger.error(
          `Conexión reemplazada, se abrió otra sesión. Cierra esta sesión primero.`
        );
        break;
      case DisconnectReason.loggedOut:
        conn.logger.error(`Sesión cerrada, elimina la carpeta ${global.authFile} y escanea nuevamente.`);
        break;
      case DisconnectReason.restartRequired:
        conn.logger.info(`Reinicio necesario, reinicia el servidor si hay problemas.`);
        await global.reloadHandler(true).catch(console.error);
        break;
      default:
        conn.logger.warn(`Desconexión desconocida: ${reason || ''} - Estado: ${connection || ''}`);
        await global.reloadHandler(true).catch(console.error);
        break;
    }
  }
}

process.on('uncaughtException', console.error);

let isInit = true;
// La importación de handler.js debe hacerse antes de que se use en reconnectSubBot
let handler = await import('./handler.js'); // Asegúrate que esta línea esté aquí

global.reloadHandler = async function (restartConn) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
    if (Handler && Object.keys(Handler).length) handler = Handler;
  } catch (e) {
    console.error(e);
  }

  if (restartConn) {
    try {
      if (global.conn.ws) global.conn.ws.close();
    } catch {}
    global.conn.ev.removeAllListeners();
    global.conn = makeWASocket(connectionOptions);
    isInit = true;
  }

  if (!isInit) {
    conn.ev.off('messages.upsert', conn.handler);
    conn.ev.off('connection.update', conn.connectionUpdate);
    conn.ev.off('creds.update', conn.credsUpdate);
  }

  conn.handler = handler.handler.bind(global.conn);
  conn.connectionUpdate = connectionUpdate.bind(global.conn);
  conn.credsUpdate = saveCreds.bind(global.conn, true);

  conn.ev.on('messages.upsert', conn.handler);
  conn.ev.on('connection.update', conn.connectionUpdate);
  conn.ev.on('creds.update', conn.credsUpdate);

  isInit = false;
  return true;
};

const pluginFolder = global.__dirname(join(__dirname, './plugins/index'));
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};

async function filesInit() {
  for (const filename of readdirSync(pluginFolder).filter(pluginFilter)) {
    try {
      const file = global.__filename(join(pluginFolder, filename));
      const module = await import(file);
      global.plugins[filename] = module.default || module;
    } catch (e) {
      conn.logger.error(e);
      delete global.plugins[filename];
    }
  }
}
await filesInit();

global.reload = async (_ev, filename) => {
  if (pluginFilter(filename)) {
    const dir = global.__filename(join(pluginFolder, filename), true);
    if (filename in global.plugins) {
      if (existsSync(dir)) conn.logger.info(`Updated plugin - '${filename}'`);
      else {
        conn.logger.warn(`Deleted plugin - '${filename}'`);
        return delete global.plugins[filename];
      }
    } else conn.logger.info(`New plugin - '${filename}'`);

    const err = syntaxerror(readFileSync(dir), filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
    });
    if (err) conn.logger.error(`Syntax error while loading '${filename}':\n${format(err)}`);
    else {
      try {
        const module = await import(`${global.__filename(dir)}?update=${Date.now()}`);
        global.plugins[filename] = module.default || module;
      } catch (e) {
        conn.logger.error(`Error requiring plugin '${filename}':\n${format(e)}`);
      } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
      }
    }
  }
};
Object.freeze(global.reload);

watch(pluginFolder, global.reload);
await global.reloadHandler();
