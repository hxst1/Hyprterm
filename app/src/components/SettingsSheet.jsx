import { useEffect, useState } from 'react'
import {
  allThemes, currentTheme, setTheme, validateTheme,
  fontSize, setFontSize, FONT_MIN, FONT_MAX, subscribe
} from '../prefs.js'
import {
  hosts, activeHostId, setActiveHost, addHost, removeHost, LOCAL_ID
} from '../hosts.js'
import { pingHost } from '../api.js'

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
