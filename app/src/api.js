const TOKEN_KEY = 'hyprterm_token'
const EXP_KEY = 'hyprterm_token_exp'

export function getToken() {
  const exp = Number(localStorage.getItem(EXP_KEY) ?? 0)
  if (exp < Date.now() + 60_000) return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token, ttlMs) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EXP_KEY, String(Date.now() + ttlMs))
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXP_KEY)
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
  return data
}

export function termWsUrl(windowIndex, cols, rows) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const params = new URLSearchParams({
    token: getToken() ?? '',
    window: String(windowIndex),
    cols: String(cols),
    rows: String(rows)
  })
  return `${proto}://${location.host}/ws/term?${params}`
}
