// Registro de hosts del tailnet. El host "local" (el que sirvió la PWA) está
// siempre presente con url relativa; los remotos se añaden por URL completa
// (https://nombre.tailnet.ts.net). Solo hay un host activo a la vez.
import { clearToken } from './tokens.js'

const HOSTS_KEY = 'hyprterm_hosts'
const ACTIVE_KEY = 'hyprterm_active_host'
const LOCAL_NAME_KEY = 'hyprterm_local_name'

export const LOCAL_ID = 'local'

const listeners = new Set()
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function emit() {
  for (const fn of listeners) fn()
}

// El host local: url '' = mismo origen (peticiones relativas). El nombre se
// puede afinar con el hostname real que devuelve /api/health.
export function localHost() {
  return {
    id: LOCAL_ID,
    name: localStorage.getItem(LOCAL_NAME_KEY) || 'este pc',
    url: '',
    color: '#c9a8d4',
    local: true
  }
}

export function setLocalName(name) {
  if (name) localStorage.setItem(LOCAL_NAME_KEY, name)
}

function readRemotes() {
  try {
    const arr = JSON.parse(localStorage.getItem(HOSTS_KEY) ?? '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeRemotes(remotes) {
  localStorage.setItem(HOSTS_KEY, JSON.stringify(remotes))
}

export function hosts() {
  return [localHost(), ...readRemotes()]
}

export function getHost(id) {
  return hosts().find(h => h.id === id) ?? null
}

// Normaliza la URL: añade https:// si falta esquema y quita la barra final.
export function normalizeUrl(raw) {
  let url = (raw ?? '').trim()
  if (!url) throw new Error('url vacía')
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  url = url.replace(/\/+$/, '')
  // valida que es una URL parseable
  new URL(url)
  return url
}

export function addHost({ name, url, color }) {
  const normUrl = normalizeUrl(url)
  const remotes = readRemotes()
  if (remotes.some(h => h.url === normUrl)) {
    throw new Error('ese host ya está en la lista')
  }
  const host = {
    id: crypto.randomUUID(),
    name: (name ?? '').trim() || new URL(normUrl).hostname.split('.')[0],
    url: normUrl,
    color: color || '#b388c4'
  }
  writeRemotes([...remotes, host])
  emit()
  return host
}

export function removeHost(id) {
  if (id === LOCAL_ID) return
  writeRemotes(readRemotes().filter(h => h.id !== id))
  clearToken(id)
  if (activeHostId() === id) setActiveHost(LOCAL_ID)
  else emit()
}

export function activeHostId() {
  return localStorage.getItem(ACTIVE_KEY) || LOCAL_ID
}

export function activeHost() {
  return getHost(activeHostId()) ?? localHost()
}

export function setActiveHost(id) {
  localStorage.setItem(ACTIVE_KEY, id)
  emit()
}

// Base URL para peticiones HTTP del host activo ('' = relativo al origen).
export function hostBase(host = activeHost()) {
  return host.url || ''
}
