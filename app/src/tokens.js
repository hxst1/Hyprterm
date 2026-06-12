// Almacenamiento de tokens por host: cada host del tailnet tiene su propia
// contraseña y por tanto su propio token. Las claves llevan el id del host
// como sufijo. Funciones puras sobre `localStorage` (testeables inyectando un
// localStorage falso en el global).

export function tokenKeys(hostId) {
  return {
    token: `hyprterm_token_${hostId}`,
    exp: `hyprterm_token_exp_${hostId}`,
    ttl: `hyprterm_token_ttl_${hostId}`
  }
}

export function getToken(hostId) {
  const k = tokenKeys(hostId)
  const exp = Number(localStorage.getItem(k.exp) ?? 0)
  // margen de 60 s: un token a punto de caducar se trata como ausente
  if (exp < Date.now() + 60_000) return null
  return localStorage.getItem(k.token)
}

export function setToken(hostId, token, ttlMs) {
  const k = tokenKeys(hostId)
  localStorage.setItem(k.token, token)
  localStorage.setItem(k.exp, String(Date.now() + ttlMs))
  localStorage.setItem(k.ttl, String(ttlMs))
}

export function clearToken(hostId) {
  const k = tokenKeys(hostId)
  localStorage.removeItem(k.token)
  localStorage.removeItem(k.exp)
  localStorage.removeItem(k.ttl)
}

// Vida restante del token (para decidir si renovar). null si no hay token.
export function tokenMeta(hostId) {
  const k = tokenKeys(hostId)
  const exp = Number(localStorage.getItem(k.exp) ?? 0)
  const ttl = Number(localStorage.getItem(k.ttl) ?? 0)
  if (!exp || !ttl) return null
  return { exp, ttl }
}

// Migración del formato mono-host (claves sin sufijo) al host 'local'.
// Se ejecuta una vez al arrancar; evita que el usuario tenga que volver a
// entrar tras actualizar a multi-host.
export function migrateLegacyToken() {
  const legacy = localStorage.getItem('hyprterm_token')
  if (!legacy) return
  const k = tokenKeys('local')
  if (!localStorage.getItem(k.token)) {
    localStorage.setItem(k.token, legacy)
    localStorage.setItem(k.exp, localStorage.getItem('hyprterm_token_exp') ?? '0')
    localStorage.setItem(k.ttl, localStorage.getItem('hyprterm_token_ttl') ?? '0')
  }
  localStorage.removeItem('hyprterm_token')
  localStorage.removeItem('hyprterm_token_exp')
  localStorage.removeItem('hyprterm_token_ttl')
}
