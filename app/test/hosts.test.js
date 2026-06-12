import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

function fakeStorage() {
  const m = new Map()
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k)
  }
}

let mod
beforeEach(async () => {
  globalThis.localStorage = fakeStorage()
  // import fresco por test para que no se arrastren listeners
  mod = await import(`../src/hosts.js?${Math.random()}`)
})

test('siempre existe el host local y es el activo por defecto', () => {
  const hs = mod.hosts()
  assert.equal(hs.length, 1)
  assert.equal(hs[0].id, 'local')
  assert.equal(mod.activeHostId(), 'local')
  assert.equal(mod.hostBase(), '') // relativo
})

test('normalizeUrl añade https y quita la barra final', () => {
  assert.equal(mod.normalizeUrl('mac.taild.ts.net'), 'https://mac.taild.ts.net')
  assert.equal(mod.normalizeUrl('https://mac.taild.ts.net/'), 'https://mac.taild.ts.net')
  assert.equal(mod.normalizeUrl('http://192.168.1.5:7705'), 'http://192.168.1.5:7705')
  assert.throws(() => mod.normalizeUrl(''))
})

test('addHost añade un remoto con id y nombre derivado del hostname', () => {
  const h = mod.addHost({ url: 'mac.taild.ts.net' })
  assert.equal(h.url, 'https://mac.taild.ts.net')
  assert.equal(h.name, 'mac') // primer segmento del hostname
  assert.ok(h.id && h.id !== 'local')
  assert.equal(mod.hosts().length, 2)
})

test('addHost respeta un nombre explícito y rechaza duplicados', () => {
  mod.addHost({ name: 'Mac de curro', url: 'mac.taild.ts.net' })
  assert.equal(mod.hosts()[1].name, 'Mac de curro')
  assert.throws(() => mod.addHost({ url: 'https://mac.taild.ts.net/' }), /ya está/)
})

test('setActiveHost cambia la base y removeHost vuelve a local', () => {
  const h = mod.addHost({ url: 'mac.taild.ts.net' })
  mod.setActiveHost(h.id)
  assert.equal(mod.activeHostId(), h.id)
  assert.equal(mod.hostBase(), 'https://mac.taild.ts.net')
  mod.removeHost(h.id)
  assert.equal(mod.activeHostId(), 'local')
  assert.equal(mod.hosts().length, 1)
})

test('removeHost ignora el host local', () => {
  mod.removeHost('local')
  assert.equal(mod.hosts().length, 1)
})

test('subscribe notifica los cambios de registro', () => {
  let n = 0
  mod.subscribe(() => n++)
  mod.addHost({ url: 'mac.taild.ts.net' })
  mod.setActiveHost('local')
  assert.ok(n >= 2)
})
