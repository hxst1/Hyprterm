import { scryptSync, timingSafeEqual, createHmac, randomBytes } from 'node:crypto'

export function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('base64')
}

export function verifyPassword(password, salt, expectedHash) {
  const got = scryptSync(password, salt, 64)
  const want = Buffer.from(expectedHash, 'base64')
  return got.length === want.length && timingSafeEqual(got, want)
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url')
}

export function signToken(secret, ttlMs) {
  const payload = JSON.stringify({ exp: Date.now() + ttlMs, n: randomBytes(8).toString('hex') })
  const body = b64url(payload)
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken(secret, token) {
  if (typeof token !== 'string') return false
  const [body, sig] = token.split('.')
  if (!body || !sig) return false
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch {
    return false
  }
}

// Anti fuerza bruta simple: backoff exponencial por IP en memoria.
const attempts = new Map()
const ATTEMPT_TTL_MS = 60 * 60 * 1000

function sweepAttempts() {
  const cutoff = Date.now() - ATTEMPT_TTL_MS
  for (const [ip, a] of attempts) if (a.last < cutoff) attempts.delete(ip)
}

export function loginThrottle(ip) {
  sweepAttempts()
  const a = attempts.get(ip)
  if (!a) return 0
  const wait = Math.min(60_000, 1000 * 2 ** (a.count - 3))
  const remaining = a.last + (a.count >= 3 ? wait : 0) - Date.now()
  return Math.max(0, remaining)
}

export function recordLogin(ip, ok) {
  if (ok) {
    attempts.delete(ip)
    return
  }
  const a = attempts.get(ip) ?? { count: 0, last: 0 }
  a.count += 1
  a.last = Date.now()
  attempts.set(ip, a)
}
