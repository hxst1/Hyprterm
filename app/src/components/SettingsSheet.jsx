import { useEffect, useState } from 'react'
import {
  allThemes, currentTheme, setTheme, validateTheme,
  fontSize, setFontSize, FONT_MIN, FONT_MAX, subscribe
} from '../prefs.js'

export default function SettingsSheet({ onClose }) {
  const [, force] = useState(0)
  useEffect(() => subscribe(() => force(n => n + 1)), [])

  const [pasted, setPasted] = useState('')
  const [pasteError, setPasteError] = useState('')
  const active = currentTheme()
  const size = fontSize()

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

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <h2>ajustes</h2>

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
      </div>
    </>
  )
}
