import test from 'node:test'
import assert from 'node:assert/strict'
import { corsHeaders } from '../src/cors.js'

test('sin Origin no devuelve cabeceras CORS', () => {
  assert.deepEqual(corsHeaders(undefined), {})
  assert.deepEqual(corsHeaders(''), {})
})

test('refleja el Origin de la petición', () => {
  const h = corsHeaders('https://arch.taild6a6a7.ts.net')
  assert.equal(h['Access-Control-Allow-Origin'], 'https://arch.taild6a6a7.ts.net')
  assert.equal(h['Vary'], 'Origin')
})

test('permite los métodos y cabeceras que usa la app', () => {
  const h = corsHeaders('https://mac.taild6a6a7.ts.net')
  for (const m of ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.ok(h['Access-Control-Allow-Methods'].includes(m), `falta ${m}`)
  }
  assert.match(h['Access-Control-Allow-Headers'], /Authorization/)
  assert.match(h['Access-Control-Allow-Headers'], /Content-Type/)
})
