// Validación/saneado de entradas que acaban en argumentos de tmux o en el pty.
// Todas las llamadas a tmux usan execFile/spawn con args en array (sin shell),
// así que no hay inyección de shell; estas funciones evitan otros abusos:
// flags disfrazados de id, nombres que rompen el parseo, y dimensiones absurdas.

const MAX_NAME = 50
const MAX_DIM = 1000

// Caracteres de control ASCII (0x00–0x1f) y DEL (0x7f). Se construye desde una
// cadena con escapes para no meter bytes de control literales en el fuente.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f]', 'g')

// id de ventana de tmux: '@' seguido de dígitos (formato estable de tmux)
export function isWindowId(id) {
  return typeof id === 'string' && /^@\d+$/.test(id)
}

// Nombre de ventana: sin caracteres de control —un '\n' rompería el parseo de
// list-windows, que separa la salida por líneas— y acotado en longitud.
export function sanitizeWindowName(raw) {
  if (typeof raw !== 'string') return ''
  return raw.replace(CONTROL_CHARS, '').trim().slice(0, MAX_NAME)
}

// Dimensiones del terminal: entero en [1, 1000]; fuera de rango → fallback.
export function clampDim(n, fallback) {
  const v = Math.floor(Number(n))
  if (!Number.isFinite(v) || v < 1) return fallback
  return Math.min(v, MAX_DIM)
}
