const TOKEN_KEY = 'hyprterm_token'
const EXP_KEY = 'hyprterm_token_exp'
const TTL_KEY = 'hyprterm_token_ttl'

export function getToken() {
  const exp = Number(localStorage.getItem(EXP_KEY) ?? 0)
  if (exp < Date.now() + 60_000) return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token, ttlMs) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EXP_KEY, String(Date.now() + ttlMs))
  localStorage.setItem(TTL_KEY, String(ttlMs))
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXP_KEY)
  localStorage.removeItem(TTL_KEY)
}

// Renueva el token cuando le queda <25 % de vida, así la sesión no caduca
// mientras se usa. Single-flight: nunca hay dos renovaciones en vuelo.
let refreshing = null

function maybeRefresh() {
  const exp = Number(localStorage.getItem(EXP_KEY) ?? 0)
  const ttl = Number(localStorage.getItem(TTL_KEY) ?? 0)
  if (!exp || !ttl || exp - Date.now() > ttl * 0.25) return
  refreshing ??= api('/api/refresh', { method: 'POST' })
    .then(d => setToken(d.token, d.ttlMs))
    .catch(() => {})
    .finally(() => { refreshing = null })
}

export class ApiError extends Error {
  constructor(status, body) {
    super(`api ${status}`)
    this.status = status
    this.body = body
  }
}

export async function api(path, { method = 'GET', body, timeoutMs = 6000 } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs)
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  if (path !== '/api/refresh') maybeRefresh()
  return data
}

// El WS se abre con un ticket de un solo uso en vez del token,
// para que el token no acabe en logs de proxies vía query string.
export async function termWsUrl(windowId, cols, rows) {
  const { ticket } = await api('/api/ws-ticket', { method: 'POST' })
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const params = new URLSearchParams({
    ticket,
    window: String(windowId),
    cols: String(cols),
    rows: String(rows)
  })
  return `${proto}://${location.host}/ws/term?${params}`
}
