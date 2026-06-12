import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hashPassword, verifyPassword,
  signToken, verifyToken,
  loginThrottle, recordLogin
} from '../src/auth.js'

const SECRET = 'secreto-de-test'

test('verifyPassword acepta la contraseña correcta y rechaza las demás', () => {
  const salt = 'c2FsLXRkZS10ZXN0'
  const hash = hashPassword('hunter22hunter22', salt)
  assert.equal(verifyPassword('hunter22hunter22', salt, hash), true)
  assert.equal(verifyPassword('hunter22hunter23', salt, hash), false)
  assert.equal(verifyPassword('', salt, hash), false)
  assert.equal(verifyPassword('hunter22hunter22', 'otra-sal', hash), false)
})

test('un token recién firmado verifica', () => {
  const token = signToken(SECRET, 60_000)
  assert.equal(verifyToken(SECRET, token), true)
})

test('un token caducado no verifica', () => {
  const token = signToken(SECRET, -1)
  assert.equal(verifyToken(SECRET, token), false)
})

test('un token firmado con otro secret no verifica', () => {
  const token = signToken('otro-secret', 60_000)
  assert.equal(verifyToken(SECRET, token), false)
})

test('un token con el payload manipulado no verifica', () => {
  const token = signToken(SECRET, 1_000)
  const [body, sig] = token.split('.')
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  payload.exp += 1000 * 60 * 60 * 24 * 365
  const forgedBody = Buffer.from(JSON.stringify(payload)).toString('base64url')
  assert.equal(verifyToken(SECRET, `${forgedBody}.${sig}`), false)
})

test('un token con la firma manipulada no verifica', () => {
  const token = signToken(SECRET, 60_000)
  const [body, sig] = token.split('.')
  const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1)
  assert.equal(verifyToken(SECRET, `${body}.${flipped}`), false)
})

test('tokens malformados no verifican ni lanzan', () => {
  for (const bad of [null, undefined, '', 'sin-punto', 'a.b', 'a.b.c', '..']) {
    assert.equal(verifyToken(SECRET, bad), false)
  }
})

test('el throttle de login aplica backoff tras varios fallos y se limpia al acertar', () => {
  const ip = '192.0.2.1'
  assert.equal(loginThrottle(ip), 0)
  recordLogin(ip, false)
  recordLogin(ip, false)
  assert.equal(loginThrottle(ip), 0, 'los dos primeros fallos no esperan')
  recordLogin(ip, false)
  assert.ok(loginThrottle(ip) > 0, 'al tercer fallo hay espera')
  recordLogin(ip, true)
  assert.equal(loginThrottle(ip), 0, 'un login correcto limpia el contador')
})
