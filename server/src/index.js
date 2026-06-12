import express from 'express'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import pty from 'node-pty'
import os from 'node:os'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'

import { loadConfig } from './config.js'
import { verifyPassword, signToken, verifyToken, loginThrottle, recordLogin } from './auth.js'
import * as tmux from './tmux.js'
import { getStats } from './stats.js'

const cfg = loadConfig()
const app = express()
app.use(express.json())

// --- API pública (solo "¿estás vivo?") ---
app.get('/api/health', (_req, res) => {
  res.json({ online: true, host: os.hostname() })
})

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
  await tmux.ensureSession(cfg.session, cfg.shell)
  res.json(await tmux.listWindows(cfg.session))
})

app.post('/api/windows', requireAuth, async (req, res) => {
  await tmux.ensureSession(cfg.session, cfg.shell)
  const id = await tmux.newWindow(cfg.session, req.body?.name, cfg.shell)
  res.json(await tmux.listWindows(cfg.session).then(ws => ws.find(w => w.id === id)))
})

app.delete('/api/windows/:id', requireAuth, async (req, res) => {
  await tmux.killWindow(req.params.id)
  res.json({ ok: true })
})

app.patch('/api/windows/:id', requireAuth, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  if (!/^@\d+$/.test(req.params.id) || !name || name.length > 50) {
    res.status(400).json({ error: 'bad_request' })
    return
  }
  await tmux.renameWindow(req.params.id, name)
  res.json({ ok: true })
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

// --- WebSocket: un pty por conexión, adjuntado a una vista agrupada de tmux ---
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws/term' })

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  if (!consumeWsTicket(url.searchParams.get('ticket'))) {
    ws.close(4001, 'unauthorized')
    return
  }

  // id de ventana de tmux (@N): estable aunque se cierren otras ventanas,
  // al contrario que el índice
  const rawWindow = url.searchParams.get('window')
  const windowId = /^@\d+$/.test(rawWindow ?? '') ? rawWindow : null
  const cols = Number(url.searchParams.get('cols')) || 80
  const rows = Number(url.searchParams.get('rows')) || 24
  const viewName = `htv_${randomBytes(4).toString('hex')}`

  let term
  try {
    await tmux.ensureSession(cfg.session, cfg.shell)
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
      } else if (msg.type === 'resize' && msg.cols > 0 && msg.rows > 0) {
        term.resize(Math.floor(msg.cols), Math.floor(msg.rows))
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

server.listen(cfg.port, () => {
  console.log(`hyprterm-server escuchando en http://0.0.0.0:${cfg.port} (sesión tmux: ${cfg.session})`)
})
