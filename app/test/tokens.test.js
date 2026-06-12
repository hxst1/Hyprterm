import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// localStorage falso para correr la lógica del navegador en node
function fakeStorage() {
  const m = new Map()
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _map: m
  }
}

let mod
beforeEach(async () => {
  globalThis.localStorage = fakeStorage()
  mod = await import('../src/tokens.js')
})

test('setToken / getToken devuelve el token mientras no caduca', () => {
  mod.setToken('local', 'abc.def', 60_000)
  assert.equal(mod.getToken('local'), 'abc.def')
})

test('getToken devuelve null si el token está a punto de caducar', () => {
  mod.setToken('local', 'abc.def', 30_000) // <60 s de margen
  assert.equal(mod.getToken('local'), null)
})

test('los tokens son independientes por host', () => {
  mod.setToken('local', 'tok-local', 60_000)
  mod.setToken('mac', 'tok-mac', 60_000)
  assert.equal(mod.getToken('local'), 'tok-local')
  assert.equal(mod.getToken('mac'), 'tok-mac')
  mod.clearToken('local')
  assert.equal(mod.getToken('local'), null)
  assert.equal(mod.getToken('mac'), 'tok-mac')
})

test('tokenMeta expone exp y ttl', () => {
  mod.setToken('local', 't', 100_000)
  const meta = mod.tokenMeta('local')
  assert.equal(meta.ttl, 100_000)
  assert.ok(meta.exp > Date.now())
  assert.equal(mod.tokenMeta('desconocido'), null)
})

test('migrateLegacyToken mueve el token mono-host al host local', () => {
  localStorage.setItem('hyprterm_token', 'viejo')
  localStorage.setItem('hyprterm_token_exp', String(Date.now() + 60_000))
  localStorage.setItem('hyprterm_token_ttl', '60000')
  mod.migrateLegacyToken()
  assert.equal(mod.getToken('local'), 'viejo')
  assert.equal(localStorage.getItem('hyprterm_token'), null)
})

test('migrateLegacyToken no pisa un token local ya existente', () => {
  mod.setToken('local', 'nuevo', 60_000)
  localStorage.setItem('hyprterm_token', 'viejo')
  mod.migrateLegacyToken()
  assert.equal(mod.getToken('local'), 'nuevo')
  assert.equal(localStorage.getItem('hyprterm_token'), null)
})
