import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { hashPassword } from './auth.js'
import { CONFIG_PATH } from './config.js'

const password = process.argv[2]
if (!password || password.length < 8) {
  console.error('Uso: pnpm setpass <contraseña>  (mínimo 8 caracteres)')
  process.exit(1)
}

const existing = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : {}
const salt = randomBytes(16).toString('base64')

// Parte de la config existente (preserva port/session/bind/startDir/… que
// pudiera haber escrito el instalador) y solo (re)genera los campos de auth.
const cfg = {
  ...existing,
  port: existing.port ?? 7705,
  session: existing.session ?? 'mobile',
  shell: existing.shell ?? null,
  salt,
  passwordHash: hashPassword(password, salt),
  secret: existing.secret ?? randomBytes(32).toString('base64'),
  tokenTtlMs: existing.tokenTtlMs ?? 1000 * 60 * 60 * 12
}
delete cfg._comment // por si se partió de config.example.json

writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 })
console.log(`Contraseña guardada en ${CONFIG_PATH}`)
