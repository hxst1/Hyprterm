import { activeHostId, hostBase } from './hosts.js'
import {
  getToken as getTokenFor,
  setToken as setTokenFor,
  clearToken as clearTokenFor,
  tokenMeta
} from './tokens.js'

// Token del host activo (la app trabaja siempre contra un host a la vez)
export function getToken() {
  return getTokenFor(activeHostId())
}
export function setToken(token, ttlMs) {
  setTokenFor(activeHostId(), token, ttlMs)
}
export function clearToken() {
  clearTokenFor(activeHostId())
}

export class ApiError extends Error {
  constructor(status, body) {
    super(`api ${status}`)
    this.status = status
    this.body = body
  }
}

// Petición a un host. Por defecto el activo; `base` permite apuntar a otro
// (p. ej. al sondear /api/health de un host inactivo).
export async function api(path, { method = 'GET', body, timeoutMs = 6000, base, auth = true } = {}) {
  const b = base ?? hostBase()
  const headers = {}
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(b + path, {
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

// Sondea la salud de un host concreto (sin auth). Devuelve el JSON o null.
export async function pingHost(host, timeoutMs = 3500) {
  try {
    return await api('/api/health', { base: host.url || '', auth: false, timeoutMs })
  } catch {
    return null
  }
}

// Descarga el wallpaper del host activo (autenticado) como object URL, o null.
export async function wallpaperObjectUrl() {
  try {
    const headers = {}
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(hostBase() + '/api/wallpaper', {
      headers,
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) return null
    return URL.createObjectURL(await res.blob())
  } catch {
    return null
  }
}

// Renueva el token del host activo cuando le queda <25 % de vida.
// Single-flight: nunca dos renovaciones a la vez.
let refreshing = null
function maybeRefresh() {
  const meta = tokenMeta(activeHostId())
  if (!meta || meta.exp - Date.now() > meta.ttl * 0.25) return
  refreshing ??= api('/api/refresh', { method: 'POST' })
    .then(d => setToken(d.token, d.ttlMs))
    .catch(() => {})
    .finally(() => { refreshing = null })
}

// Base WS del host activo: local usa location.host; remoto convierte http(s)→ws(s)
function wsBase() {
  const base = hostBase()
  if (!base) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${location.host}`
  }
  return base.replace(/^http/, 'ws')
}

// Los WS se abren con un ticket de un solo uso en vez del token, para que el
// token no acabe en logs de proxies vía query string.
async function wsUrl(path, params = {}) {
  const { ticket } = await api('/api/ws-ticket', { method: 'POST' })
  const qs = new URLSearchParams({ ticket, ...params })
  return `${wsBase()}${path}?${qs}`
}

export function termWsUrl(windowId, cols, rows) {
  return wsUrl('/ws/term', { window: String(windowId), cols: String(cols), rows: String(rows) })
}

export function controlWsUrl() {
  return wsUrl('/ws/control')
}
