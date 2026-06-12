import express from 'express'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import pty from 'node-pty'
import os from 'node:os'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'

import { loadConfig } from './config.js'
import { verifyPassword, signToken, verifyToken, loginThrottle, recordLogin } from './auth.js'
import { corsHeaders } from './cors.js'
import { isWindowId, sanitizeWindowName, clampDim } from './validate.js'
import * as tmux from './tmux.js'
import { getStats } from './stats.js'

const cfg = loadConfig()
const app = express()
app.use(express.json())

// CORS: permite que la PWA servida por otro host del tailnet llame a esta API
app.use((req, res, next) => {
  for (const [k, v] of Object.entries(corsHeaders(req.headers.origin))) {
    res.setHeader(k, v)
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})

// --- API pública (solo "¿estás vivo?") ---
app.get('/api/health', (_req, res) => {
  res.json({
    online: true,
    host: os.hostname(),
    build: readBuildId(),
    wallpaper: Boolean(cfg.wallpaper) // ¿hay imagen de fondo configurada?
  })
})

// build actual de la PWA servida — el cliente se recarga si no coincide con el suyo
function readBuildId() {
  try {
    return JSON.parse(readFileSync(join(dist, 'build-id.json'), 'utf8')).build
  } catch {
    return null
  }
}

app.post('/api/login', (req, res) => {
  const ip = req.socket.remoteAddress ?? '?'
  const wait = loginThrottle(ip)
  if (wait > 0) {
    res.status(429).json({ error: 'too_many_attempts', retryMs: wait })
    return
  }
  const { password } = req.body ?? {}
  const ok = typeof password === 'string' && verifyPassword(password, cfg.salt, cfg.passwordHash)
  recordLogin(ip, ok)
  if (!ok) {
    res.status(401).json({ error: 'bad_password' })
    return
  }
  res.json({ token: signToken(cfg.secret, cfg.tokenTtlMs), ttlMs: cfg.tokenTtlMs })
})

// --- API autenticada ---
function requireAuth(req, res, next) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '')
  if (!verifyToken(cfg.secret, token)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  next()
}

// Token válido → token nuevo; el cliente renueva antes de caducar
app.post('/api/refresh', requireAuth, (_req, res) => {
  res.json({ token: signToken(cfg.secret, cfg.tokenTtlMs), ttlMs: cfg.tokenTtlMs })
})

// Tickets de un solo uso y vida corta para abrir el WebSocket sin exponer
// el token en la query string (las URLs acaban en logs de proxies).
const WS_TICKET_TTL_MS = 30_000
const wsTickets = new Map() // ticket -> caducidad

app.post('/api/ws-ticket', requireAuth, (_req, res) => {
  const now = Date.now()
  for (const [t, exp] of wsTickets) if (exp < now) wsTickets.delete(t)
  const ticket = randomBytes(16).toString('hex')
  wsTickets.set(ticket, now + WS_TICKET_TTL_MS)
  res.json({ ticket, ttlMs: WS_TICKET_TTL_MS })
})

function consumeWsTicket(ticket) {
  if (typeof ticket !== 'string') return false
  const exp = wsTickets.get(ticket)
  wsTickets.delete(ticket)
  return exp !== undefined && exp >= Date.now()
}

app.get('/api/windows', requireAuth, async (_req, res) => {
  await tmux.ensureSession(cfg.session, cfg.shell, cfg.startDir)
  res.json(await tmux.listWindows(cfg.session))
})

app.post('/api/windows', requireAuth, async (req, res) => {
  await tmux.ensureSession(cfg.session, cfg.shell, cfg.startDir)
  const name = sanitizeWindowName(req.body?.name) || null
  const id = await tmux.newWindow(cfg.session, name, cfg.shell, cfg.startDir)
  res.json(await tmux.listWindows(cfg.session).then(ws => ws.find(w => w.id === id)))
  broadcastWindows()
})

app.delete('/api/windows/:id', requireAuth, async (req, res) => {
  if (!isWindowId(req.params.id)) {
    res.status(400).json({ error: 'bad_request' })
    return
  }
  await tmux.killWindow(req.params.id)
  res.json({ ok: true })
  broadcastWindows()
})

app.patch('/api/windows/:id', requireAuth, async (req, res) => {
  const name = sanitizeWindowName(req.body?.name)
  if (!isWindowId(req.params.id) || !name) {
    res.status(400).json({ error: 'bad_request' })
    return
  }
  await tmux.renameWindow(req.params.id, name)
  res.json({ ok: true })
  broadcastWindows()
})

// Temas del usuario: archivos JSON en ~/.config/hyprterm/themes/
const themesDir = join(os.homedir(), '.config', 'hyprterm', 'themes')

app.get('/api/themes', requireAuth, async (_req, res) => {
  let files = []
  try {
    files = (await readdir(themesDir)).filter(f => f.endsWith('.json'))
  } catch {
    res.json([]) // el directorio no existe: sin temas propios
    return
  }
  const themes = []
  for (const f of files) {
    try {
      const theme = JSON.parse(await readFile(join(themesDir, f), 'utf8'))
      theme.id = theme.id ?? f.replace(/\.json$/, '')
      themes.push(theme)
    } catch (err) {
      console.error(`tema ${f} ilegible:`, err.message)
    }
  }
  res.json(themes)
})

app.get('/api/stats', requireAuth, async (_req, res) => {
  res.json(await getStats())
})

// Imagen de fondo configurada (cfg.wallpaper). Autenticada: el cliente la pide
// con el token y la usa como blob, así no se sirve a cualquiera sin login.
const WALLPAPER_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif'
}
app.get('/api/wallpaper', requireAuth, (_req, res) => {
  if (!cfg.wallpaper || !existsSync(cfg.wallpaper)) {
    res.status(404).json({ error: 'no_wallpaper' })
    return
  }
  const ext = cfg.wallpaper.slice(cfg.wallpaper.lastIndexOf('.')).toLowerCase()
  res.type(WALLPAPER_TYPES[ext] ?? 'application/octet-stream')
  // dotfiles:'allow' porque la ruta suele estar bajo ~/.config (Express los veta por defecto)
  res.sendFile(cfg.wallpaper, { dotfiles: 'allow' }, err => {
    if (err && !res.headersSent) res.status(500).end()
  })
})

// Imagen pegada desde el portapapeles del cliente: la terminal solo acepta
// texto, así que se guarda en disco y se devuelve la ruta para pegarla.
const PASTE_TYPES = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif'
}

app.post('/api/paste-image', requireAuth,
  express.raw({ type: Object.keys(PASTE_TYPES), limit: '25mb' }),
  async (req, res) => {
    const ext = PASTE_TYPES[req.headers['content-type']]
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'bad_image' })
      return
    }
    await mkdir(cfg.uploadsDir, { recursive: true })
    // nombre con fecha legible + sufijo aleatorio contra colisiones
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')
    const file = join(cfg.uploadsDir, `pegado-${stamp}-${randomBytes(3).toString('hex')}${ext}`)
    await writeFile(file, req.body)
    res.json({ path: file })
  })

// --- Frontend estático (build de la PWA) ---
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, '..', 'app', 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api|\/ws).*/, (_req, res) => res.sendFile(join(dist, 'index.html')))
}

// Con Express 5 las promesas rechazadas de rutas async llegan aquí
app.use((err, _req, res, _next) => {
  console.error('error en ruta:', err.message)
  if (!res.headersSent) res.status(500).json({ error: 'internal' })
})

// --- WebSockets ---
// noServer + enrutado manual del upgrade: dos WebSocketServer colgados del
// mismo http.Server se pisan el handshake entre sí.
const server = createServer(app)
const controlWss = new WebSocketServer({ noServer: true })
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  const target = pathname === '/ws/control' ? controlWss : pathname === '/ws/term' ? wss : null
  if (!target) {
    socket.destroy()
    return
  }
  target.handleUpgrade(req, socket, head, ws => target.emit('connection', ws, req))
})

// --- WebSocket de control: push de ventanas y stats (sustituye al polling) ---
// Un solo vigilante en el host difunde a todos los clientes; el iPhone no sondea.

const WINDOWS_SWEEP_MS = 2000   // cambios hechos fuera de la API (p. ej. desde el PC)
const STATS_EVERY_TICKS = 2     // stats cada 2 barridos (4 s)

let lastWindowsJson = ''
let controlTimer = null
let tick = 0

function controlSend(payload) {
  const msg = JSON.stringify(payload)
  for (const client of controlWss.clients) {
    if (client.readyState === client.OPEN) client.send(msg)
  }
}

async function broadcastWindows(force = false) {
  if (controlWss.clients.size === 0) return
  try {
    await tmux.ensureSession(cfg.session, cfg.shell, cfg.startDir)
    const windows = await tmux.listWindows(cfg.session)
    const json = JSON.stringify(windows)
    if (force || json !== lastWindowsJson) {
      lastWindowsJson = json
      controlSend({ type: 'windows', windows })
    }
  } catch (err) {
    console.error('error difundiendo ventanas:', err.message)
  }
}

async function broadcastStats() {
  if (controlWss.clients.size === 0) return
  try {
    controlSend({ type: 'stats', stats: await getStats() })
  } catch { /* sin stats no pasa nada */ }
}

controlWss.on('connection', async (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  if (!consumeWsTicket(url.searchParams.get('ticket'))) {
    ws.close(4001, 'unauthorized')
    return
  }
  // estado inicial inmediato para este cliente
  try {
    await tmux.ensureSession(cfg.session, cfg.shell, cfg.startDir)
    const windows = await tmux.listWindows(cfg.session)
    lastWindowsJson = JSON.stringify(windows)
    ws.send(JSON.stringify({ type: 'windows', windows }))
    ws.send(JSON.stringify({ type: 'stats', stats: await getStats() }))
  } catch (err) {
    console.error('error en estado inicial de control:', err.message)
  }
  // el vigilante solo corre mientras haya clientes conectados
  if (!controlTimer) {
    controlTimer = setInterval(async () => {
      await broadcastWindows()
      if (++tick % STATS_EVERY_TICKS === 0) await broadcastStats()
    }, WINDOWS_SWEEP_MS)
  }
  ws.on('close', () => {
    if (controlWss.clients.size === 0 && controlTimer) {
      clearInterval(controlTimer)
      controlTimer = null
    }
  })
})

// --- WebSocket de terminal: un pty por conexión, adjuntado a una vista agrupada de tmux ---
wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  if (!consumeWsTicket(url.searchParams.get('ticket'))) {
    ws.close(4001, 'unauthorized')
    return
  }

  // id de ventana de tmux (@N): estable aunque se cierren otras ventanas,
  // al contrario que el índice
  const rawWindow = url.searchParams.get('window')
  const windowId = isWindowId(rawWindow) ? rawWindow : null
  const cols = clampDim(url.searchParams.get('cols'), 80)
  const rows = clampDim(url.searchParams.get('rows'), 24)
  const viewName = `htv_${randomBytes(4).toString('hex')}`

  let term
  try {
    await tmux.ensureSession(cfg.session, cfg.shell, cfg.startDir)
    await tmux.prepareView(cfg.session, viewName, windowId)
    term = pty.spawn('tmux', ['attach-session', '-t', `=${viewName}`], {
      name: 'xterm-256color',
      cols,
      rows,
      env: { ...process.env, TERM: 'xterm-256color' }
    })
  } catch (err) {
    console.error('error preparando vista tmux:', err.message)
    ws.close(4500, 'tmux_error')
    await tmux.killView(viewName)
    return
  }

  term.onData(data => {
    if (ws.readyState === ws.OPEN) ws.send(data)
  })

  term.onExit(() => {
    if (ws.readyState === ws.OPEN) ws.close(1000, 'pty_exit')
  })

  ws.on('message', raw => {
    // Frames de texto JSON = control; el input de teclado va como {type:'input'}
    try {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'input' && typeof msg.data === 'string') {
        term.write(msg.data)
      } else if (msg.type === 'resize') {
        term.resize(clampDim(msg.cols, cols), clampDim(msg.rows, rows))
      }
    } catch {
      // mensaje malformado: ignorar
    }
  })

  ws.on('close', async () => {
    term.kill()
    await tmux.killView(viewName)
  })
})

await tmux.cleanupViews()

const isLoopback = cfg.bind === '127.0.0.1' || cfg.bind === '::1' || cfg.bind === 'localhost'
server.listen(cfg.port, cfg.bind, () => {
  console.log(`hyprterm-server escuchando en http://${cfg.bind}:${cfg.port} (sesión tmux: ${cfg.session})`)
  if (!isLoopback) {
    console.warn(
      `⚠  ATENCIÓN: escuchando en ${cfg.bind} — el server expone shells y es ` +
      `accesible desde la red, no solo por tailscale. Asegúrate de que hay un ` +
      `firewall delante. Para escuchar solo en loopback, quita "bind" de config.json.`
    )
  }
})
