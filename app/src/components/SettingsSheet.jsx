import { useEffect, useRef, useState } from 'react'
import {
  allThemes, currentTheme, setTheme, validateTheme,
  fontSize, setFontSize, FONT_MIN, FONT_MAX, subscribe,
  wallpaperMode, setWallpaperMode, wallpaperDim, setWallpaperDim, setCustomWallpaper
} from '../prefs.js'
import {
  hosts, activeHostId, setActiveHost, addHost, removeHost, LOCAL_ID
} from '../hosts.js'
import { pingHost, api } from '../api.js'

// Reescala una imagen a un máximo de lado y la devuelve como data URL JPEG,
// para no llenar localStorage con la imagen original a tamaño completo.
function downscaleImage(file, maxSide = 1920, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function SettingsSheet({ onClose, onLock }) {
  const [, force] = useState(0)
  useEffect(() => subscribe(() => force(n => n + 1)), [])

  const [pasted, setPasted] = useState('')
  const [pasteError, setPasteError] = useState('')
  const active = currentTheme()
  const size = fontSize()

  // estado online/offline de cada host (id → bool|null mientras sondea)
  const [status, setStatus] = useState({})
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [hostError, setHostError] = useState('')

  // wallpaper
  const [hostHasWall, setHostHasWall] = useState(false)
  const [wallError, setWallError] = useState('')
  const fileRef = useRef(null)
  useEffect(() => {
    api('/api/health').then(h => setHostHasWall(Boolean(h?.wallpaper))).catch(() => {})
  }, [])

  async function pickWallpaper(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite re-elegir el mismo archivo
    if (!file) return
    setWallError('')
    try {
      const dataUrl = await downscaleImage(file)
      setCustomWallpaper(dataUrl)
      await setWallpaperMode('custom')
    } catch {
      setWallError('no pude cargar esa imagen')
    }
  }

  async function pingAll() {
    const list = hosts()
    setStatus(Object.fromEntries(list.map(h => [h.id, null])))
    await Promise.all(list.map(async h => {
      const ok = !!(await pingHost(h))
      setStatus(prev => ({ ...prev, [h.id]: ok }))
    }))
  }
  useEffect(() => { pingAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function switchHost(id) {
    if (id === activeHostId()) { onClose(); return }
    setActiveHost(id) // App re-chequea y remonta; cerrar la hoja
    onClose()
  }

  function submitHost(e) {
    e.preventDefault()
    try {
      addHost({ name: newName, url: newUrl })
      setNewName(''); setNewUrl(''); setAdding(false); setHostError('')
      pingAll()
    } catch (err) {
      setHostError(err.message)
    }
  }

  function applyPasted() {
    try {
      validateTheme(JSON.parse(pasted))
      setTheme(pasted.trim())
      setPasted('')
      setPasteError('')
    } catch (err) {
      setPasteError(`tema no válido: ${err.message}`)
    }
  }

  const dot = id => status[id] === null || status[id] === undefined ? '#888'
    : status[id] ? 'var(--good)' : 'var(--bad)'

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <h2>ajustes</h2>

        <h3>hosts</h3>
        {hosts().map(h => (
          <div key={h.id} className={`theme-row host ${h.id === activeHostId() ? 'active' : ''}`}>
            <button className="host-pick" onClick={() => switchHost(h.id)}>
              <i className="status-dot" style={{ background: dot(h.id) }} />
              <span>{h.name}</span>
              {h.id === activeHostId() && <span className="badge">activo</span>}
            </button>
            {h.id !== LOCAL_ID && (
              <span className="close-x" onClick={() => { removeHost(h.id); pingAll() }}>✕</span>
            )}
          </div>
        ))}
        {adding ? (
          <form className="host-form" onSubmit={submitHost}>
            <input
              placeholder="nombre (opcional)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input
              placeholder="url (p. ej. mac.tu-tailnet.ts.net)"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
            />
            {hostError && <div className="errmsg">{hostError}</div>}
            <div className="sheet-actions">
              <button className="btn" type="submit" disabled={!newUrl.trim()}>añadir</button>
              <button className="btn ghost" type="button" onClick={() => { setAdding(false); setHostError('') }}>cancelar</button>
            </div>
          </form>
        ) : (
          <button className="theme-row add-host" onClick={() => setAdding(true)}>
            <span>+ añadir host</span>
          </button>
        )}

        <h3>tema</h3>
        {allThemes().map(t => (
          <button
            key={t.id}
            className={`theme-row ${t.id === active.id ? 'active' : ''}`}
            onClick={() => setTheme(t.id)}
          >
            <span>{t.name}</span>
            <span className="swatches">
              {[t.ui.bg2, t.ui.accent, t.ui.accent2, t.ui.good, t.ui.warn].map((c, i) => (
                <i key={i} style={{ background: c }} />
              ))}
            </span>
          </button>
        ))}

        <h3>tamaño de fuente</h3>
        <div className="fontsize-row">
          <button className="key" onClick={() => setFontSize(size - 1)} disabled={size <= FONT_MIN}>A−</button>
          <b>{size}px</b>
          <button className="key" onClick={() => setFontSize(size + 1)} disabled={size >= FONT_MAX}>A+</button>
        </div>

        <h3>fondo</h3>
        <div className="wall-modes">
          <button
            className={`key ${wallpaperMode() === 'none' ? 'sticky-on' : ''}`}
            onClick={() => setWallpaperMode('none')}
          >ninguno</button>
          <button
            className={`key ${wallpaperMode() === 'host' ? 'sticky-on' : ''}`}
            onClick={() => setWallpaperMode('host')}
            disabled={!hostHasWall}
            title={hostHasWall ? '' : 'este host no tiene wallpaper configurado'}
          >del host</button>
          <button
            className={`key ${wallpaperMode() === 'custom' ? 'sticky-on' : ''}`}
            onClick={() => fileRef.current?.click()}
          >subir…</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickWallpaper} />
        </div>
        {wallError && <div className="errmsg">{wallError}</div>}
        {wallpaperMode() !== 'none' && (
          <label className="dim-row">
            <span>atenuar</span>
            <input
              type="range" min="0" max="90" step="5"
              value={wallpaperDim()}
              onChange={e => setWallpaperDim(Number(e.target.value))}
            />
            <b>{wallpaperDim()}%</b>
          </label>
        )}

        <h3>tema propio</h3>
        <textarea
          value={pasted}
          onChange={e => setPasted(e.target.value)}
          placeholder='pega aquí un tema JSON ({"name": …, "ui": …, "terminal": …})'
        />
        {pasteError && <div className="errmsg">{pasteError}</div>}
        <div className="sheet-actions">
          <button className="btn" onClick={applyPasted} disabled={!pasted.trim()}>aplicar</button>
        </div>
        <p className="hint">
          también puedes dejar archivos .json en ~/.config/hyprterm/themes/ del host
          y aparecerán en la lista al recargar.
        </p>

        <h3>sesión</h3>
        <button className="theme-row lock" onClick={onLock}>
          <span>🔒 bloquear (cerrar sesión)</span>
        </button>
        <p className="hint">
          pedirá la contraseña de nuevo; tus terminales siguen abiertas en tmux.
        </p>
      </div>
    </>
  )
}
