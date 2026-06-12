import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const CONFIG_PATH = join(root, 'config.json')

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.error('No existe config.json — ejecuta primero: npm run setpass -- <contraseña>')
    process.exit(1)
  }
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  return {
    port: cfg.port ?? 7705,
    // Interfaz de escucha. Por defecto solo loopback: `tailscale serve` proxya
    // a 127.0.0.1, así que no hace falta exponerse a la LAN. Pon '0.0.0.0'
    // explícitamente solo si sabes lo que haces (red de confianza sin tailscale).
    bind: cfg.bind ?? '127.0.0.1',
    session: cfg.session ?? 'mobile',
    shell: cfg.shell ?? null,
    // dónde nacen las ventanas; por defecto el home, no el cwd del servicio
    startDir: cfg.startDir ?? homedir(),
    passwordHash: cfg.passwordHash,
    salt: cfg.salt,
    secret: cfg.secret,
    tokenTtlMs: cfg.tokenTtlMs ?? 1000 * 60 * 60 * 12
  }
}
