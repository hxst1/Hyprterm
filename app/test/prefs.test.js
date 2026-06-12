import test from 'node:test'
import assert from 'node:assert/strict'
import { dimRgba } from '../src/prefs.js'

test('dimRgba convierte hex + porcentaje a rgba', () => {
  assert.equal(dimRgba('#1a1622', 40), 'rgba(26, 22, 34, 0.4)')
  assert.equal(dimRgba('1a1622', 40), 'rgba(26, 22, 34, 0.4)') // sin almohadilla
  assert.equal(dimRgba('#000000', 0), 'rgba(0, 0, 0, 0)')
  assert.equal(dimRgba('#ffffff', 50), 'rgba(255, 255, 255, 0.5)')
})

test('dimRgba acota el porcentaje a [0,90] y tolera entradas raras', () => {
  assert.equal(dimRgba('#1a1622', 200), 'rgba(26, 22, 34, 0.9)') // tope 90%
  assert.equal(dimRgba('#1a1622', -10), 'rgba(26, 22, 34, 0)')
  assert.equal(dimRgba(null, 40), 'rgba(0, 0, 0, 0.4)')          // hex inválido → negro
  assert.equal(dimRgba('#xyz', 40), 'rgba(0, 0, 0, 0.4)')
})
