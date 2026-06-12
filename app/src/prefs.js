// Preferencias de apariencia: tema, tamaño de fuente y wallpaper de fondo.
// Store mínimo con suscripción (las TermView vivas se actualizan al instante).
import { PRESETS } from './themes/presets.js'
import { api, wallpaperObjectUrl } from './api.js'

const THEME_KEY = 'hyprterm_theme'        // id de preset/tema del host, o JSON custom
const FONT_KEY = 'hyprterm_fontsize'
const WALL_MODE_KEY = 'hyprterm_wall_mode'   // 'none' | 'host' | 'custom'
const WALL_DIM_KEY = 'hyprterm_wall_dim'     // % de oscurecido (0–90)
const WALL_CUSTOM_KEY = 'hyprterm_wall_img'  // data URL de imagen subida

export const FONT_MIN = 9
export const FONT_MAX = 22
const FONT_DEFAULT = 13

export const WALL_DIM_DEFAULT = 40

const listeners = new Set()
let hostThemes = []                        // de ~/.config/hyprterm/themes/ vía API

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  for (const fn of listeners) fn()
}

// --- temas ---

export function allThemes() {
  // un tema del host con el mismo id que un preset lo sobreescribe
  const byId = new Map(PRESETS.map(t => [t.id, t]))
  for (const t of hostThemes) byId.set(t.id, t)
  const custom = readCustom()
  if (custom) byId.set(custom.id, custom)
  return [...byId.values()]
}

function readCustom() {
  const raw = localStorage.getItem(THEME_KEY)
  if (!raw?.startsWith('{')) return null
  try {
    const t = validateTheme(JSON.parse(raw))
    return { ...t, id: 'custom', name: `${t.name} (pegado)` }
  } catch {
    return null
  }
}

export function validateTheme(t) {
  if (typeof t !== 'object' || t === null) throw new Error('el tema no es un objeto')
  if (typeof t.name !== 'string' || !t.name) throw new Error('falta "name"')
  if (typeof t.ui !== 'object' || t.ui === null) throw new Error('falta "ui"')
  for (const k of ['bg0', 'bg1', 'bg2', 'surface0', 'surface1', 'text', 'subtext',
    'accent', 'accent2', 'soft', 'good', 'bad', 'warn']) {
    if (typeof t.ui[k] !== 'string') throw new Error(`falta ui.${k}`)
  }
  if (typeof t.terminal !== 'object' || t.terminal === null) throw new Error('falta "terminal"')
  return t
}

export function currentTheme() {
  const raw = localStorage.getItem(THEME_KEY)
  if (raw?.startsWith('{')) return readCustom() ?? PRESETS[0]
  return allThemes().find(t => t.id === raw) ?? PRESETS[0]
}

export function setTheme(idOrJson) {
  localStorage.setItem(THEME_KEY, idOrJson)
  applyTheme()
  emit()
}

// El lienzo de xterm es siempre transparente: el fondo real lo pinta el panel
// (--term-panel), translúcido estilo kitty con background_opacity.
export function xtermTheme() {
  const t = currentTheme()
  return { ...t.terminal, background: 'rgba(0,0,0,0)' }
}

// Vuelca la paleta ui a variables CSS (theme.css las consume)
export function applyTheme() {
  const { ui, terminal } = currentTheme()
  const root = document.documentElement.style
  const vars = {
    '--bg0': ui.bg0, '--bg1': ui.bg1, '--bg2': ui.bg2,
    '--surface0': ui.surface0, '--surface1': ui.surface1,
    '--text': ui.text, '--subtext': ui.subtext,
    '--accent': ui.accent, '--accent2': ui.accent2, '--soft': ui.soft,
    '--good': ui.good, '--bad': ui.bad, '--warn': ui.warn,
    '--wall-a': ui.wallpaper?.[0] ?? ui.bg2, '--wall-b': ui.wallpaper?.[1] ?? ui.bg0,
    '--term-bg': terminal.background ?? ui.bg2
  }
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ui.bg0)
  paintBackground() // el oscurecido del wallpaper depende de bg0 del tema
}

// --- wallpaper de fondo ---

// Convierte un hex (#rrggbb) + porcentaje a rgba para la capa de oscurecido.
export function dimRgba(hex, pct) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  const n = m ? parseInt(m[1], 16) : 0
  const a = Math.max(0, Math.min(90, Number(pct) || 0)) / 100
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

export function wallpaperMode() {
  const m = localStorage.getItem(WALL_MODE_KEY)
  return m === 'host' || m === 'custom' ? m : 'none'
}

export function wallpaperDim() {
  const n = Number(localStorage.getItem(WALL_DIM_KEY))
  return n >= 0 && n <= 90 ? n : WALL_DIM_DEFAULT
}

export function setWallpaperDim(n) {
  localStorage.setItem(WALL_DIM_KEY, String(Math.max(0, Math.min(90, n))))
  paintBackground()
  emit()
}

export function customWallpaper() {
  return localStorage.getItem(WALL_CUSTOM_KEY)
}

export function setCustomWallpaper(dataUrl) {
  if (dataUrl) localStorage.setItem(WALL_CUSTOM_KEY, dataUrl)
  else localStorage.removeItem(WALL_CUSTOM_KEY)
}

let resolvedBgUrl = null   // url de imagen actual (object URL o data URL)
let lastObjectUrl = null   // para revocar el object URL anterior y no fugar memoria

// Pinta el fondo del body desde la imagen resuelta + el oscurecido del tema.
function paintBackground() {
  const root = document.documentElement.style
  // panel del terminal: siempre un poco translúcido (como kitty); más abierto
  // sobre wallpaper para que se aprecie la imagen
  if (resolvedBgUrl) {
    root.setProperty('--bg-image', `url("${resolvedBgUrl}")`)
    root.setProperty('--bg-dim', dimRgba(currentTheme().ui.bg0, wallpaperDim()))
    root.setProperty('--term-panel', 'color-mix(in srgb, var(--term-bg) 58%, transparent)')
  } else {
    root.setProperty('--bg-image', 'none')
    root.setProperty('--bg-dim', 'transparent')
    root.setProperty('--term-panel', 'color-mix(in srgb, var(--term-bg) 85%, transparent)')
  }
}

// Resuelve la imagen según el modo (host = fetch autenticado) y la pinta.
export async function applyWallpaper() {
  const mode = wallpaperMode()
  let url = null
  if (mode === 'custom') {
    url = customWallpaper()
  } else if (mode === 'host') {
    url = await wallpaperObjectUrl()
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl)
    lastObjectUrl = url
  }
  resolvedBgUrl = url
  paintBackground()
  emit()
}

export async function setWallpaperMode(mode) {
  localStorage.setItem(WALL_MODE_KEY, mode)
  await applyWallpaper()
}

// Temas del host (~/.config/hyprterm/themes/*.json). Silencioso si falla.
export async function loadHostThemes() {
  try {
    const themes = await api('/api/themes')
    hostThemes = themes.flatMap(t => {
      try { return [validateTheme(t)] } catch { return [] }
    })
    if (hostThemes.length) {
      applyTheme() // por si el tema activo es del host y acaba de llegar
      emit()
    }
  } catch { /* sin temas del host */ }
}

// --- tamaño de fuente ---

export function fontSize() {
  const n = Number(localStorage.getItem(FONT_KEY))
  return n >= FONT_MIN && n <= FONT_MAX ? n : FONT_DEFAULT
}

export function setFontSize(n) {
  const clamped = Math.max(FONT_MIN, Math.min(FONT_MAX, n))
  localStorage.setItem(FONT_KEY, String(clamped))
  emit()
}
