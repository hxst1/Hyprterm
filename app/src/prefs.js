// Preferencias de apariencia: tema y tamaño de fuente.
// Store mínimo con suscripción (las TermView vivas se actualizan al instante).
import { PRESETS } from './themes/presets.js'
import { api } from './api.js'

const THEME_KEY = 'hyprterm_theme'        // id de preset/tema del host, o JSON custom
const FONT_KEY = 'hyprterm_fontsize'

export const FONT_MIN = 9
export const FONT_MAX = 22
const FONT_DEFAULT = 13

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

export function xtermTheme() {
  const t = currentTheme()
  return { ...t.terminal, background: t.terminal.background ?? t.ui.bg2 }
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
