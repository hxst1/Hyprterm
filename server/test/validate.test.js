import test from 'node:test'
import assert from 'node:assert/strict'
import { isWindowId, sanitizeWindowName, clampDim } from '../src/validate.js'

test('isWindowId solo acepta @<dígitos>', () => {
  assert.equal(isWindowId('@0'), true)
  assert.equal(isWindowId('@42'), true)
  assert.equal(isWindowId('0'), false)
  assert.equal(isWindowId('@'), false)
  assert.equal(isWindowId('@1a'), false)
  assert.equal(isWindowId('mobile'), false)
  assert.equal(isWindowId('-a'), false)
  assert.equal(isWindowId(null), false)
  assert.equal(isWindowId(undefined), false)
})

test('sanitizeWindowName quita saltos de línea y otros controles', () => {
  // un '\n' rompería el parseo línea-a-línea de list-windows
  assert.equal(sanitizeWindowName('build\nfake|99|1|sh|hack'), 'buildfake|99|1|sh|hack')
  assert.equal(sanitizeWindowName('a\tb\rc'), 'abc')
  assert.equal(sanitizeWindowName('  hola  '), 'hola')
})

test('sanitizeWindowName acota a 50 caracteres', () => {
  assert.equal(sanitizeWindowName('x'.repeat(80)).length, 50)
})

test('sanitizeWindowName tolera entradas no string', () => {
  assert.equal(sanitizeWindowName(null), '')
  assert.equal(sanitizeWindowName(123), '')
  assert.equal(sanitizeWindowName(undefined), '')
})

test('sanitizeWindowName conserva acentos y emojis (no son control)', () => {
  assert.equal(sanitizeWindowName('ñandú 🚀'), 'ñandú 🚀')
})

test('clampDim devuelve enteros en [1,1000] y usa el fallback', () => {
  assert.equal(clampDim(80, 24), 80)
  assert.equal(clampDim(0, 24), 24)
  assert.equal(clampDim(-5, 24), 24)
  assert.equal(clampDim(1e9, 24), 1000)
  assert.equal(clampDim('120', 24), 120)
  assert.equal(clampDim('abc', 24), 24)
  assert.equal(clampDim(40.9, 24), 40)
  assert.equal(clampDim(undefined, 80), 80)
})
