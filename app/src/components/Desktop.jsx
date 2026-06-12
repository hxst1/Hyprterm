import { useCallback, useEffect, useRef, useState } from 'react'
import { api, controlWsUrl } from '../api.js'
import Waybar from './Waybar.jsx'
import TermView from './TermView.jsx'
import KeyBar from './KeyBar.jsx'
import SettingsSheet from './SettingsSheet.jsx'
import { loadHostThemes, applyWallpaper, subscribe as subscribePrefs, terminalTransparent } from '../prefs.js'

export default function Desktop({ onAuthLost }) {
  const [windows, setWindows] = useState([])
  const [stats, setStats] = useState(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [mods, setMods] = useState({ ctrl: false, alt: false, shift: false })
  const [settingsOpen, setSettingsOpen] = useState(false)
  // la transparencia es de construcción del terminal: si cambia, hay que
  // remontar las TermView (cambiando su key) para recrear el renderer
  const [transparent, setTransparent] = useState(terminalTransparent())
  useEffect(() => subscribePrefs(() => setTransparent(terminalTransparent())), [])

  const pagerRef = useRef(null)
  const termsRef = useRef(new Map())
  const modsRef = useRef(mods)
  modsRef.current = mods
  const scrollToEndRef = useRef(false)

  const applyWindows = useCallback(ws => {
    setWindows(prev => {
      const same = prev.length === ws.length &&
        prev.every((w, i) => w.id === ws[i].id && w.name === ws[i].name && w.command === ws[i].command)
      return same ? prev : ws
    })
  }, [])

  // Carga inicial por HTTP (rápida) — luego el WS de control empuja los cambios
  const refresh = useCallback(async () => {
    try {
      applyWindows(await api('/api/windows'))
    } catch (err) {
      if (err.status === 401) onAuthLost()
    }
  }, [applyWindows, onAuthLost])

  useEffect(() => {
    refresh()
    loadHostThemes() // ya hay sesión: trae los temas de ~/.config/hyprterm/themes/
    applyWallpaper() // el modo 'host' necesita token, así que se resuelve aquí
  }, [refresh])

  // WS de control: push de ventanas y stats en vez de polling
  useEffect(() => {
    let ws = null
    let closed = false
    let retry = 0
    let timer = null

    async function connect() {
      if (closed) return
      let url
      try {
        url = await controlWsUrl()
      } catch (err) {
        if (err.status === 401) { onAuthLost(); return }
        schedule()
        return
      }
      if (closed) return
      ws = new WebSocket(url)
      ws.onopen = () => { retry = 0 }
      ws.onmessage = e => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'windows') applyWindows(msg.windows)
          else if (msg.type === 'stats') setStats(msg.stats)
        } catch { /* mensaje malformado */ }
      }
      ws.onclose = () => { if (!closed) schedule() }
    }

    function schedule() {
      const wait = Math.min(8000, 1000 * 2 ** retry)
      retry += 1
      timer = setTimeout(connect, wait)
    }

    connect()
    return () => {
      closed = true
      clearTimeout(timer)
      ws?.close()
    }
  }, [applyWindows, onAuthLost])

  // Tras crear una ventana, desliza hasta ella
  useEffect(() => {
    if (scrollToEndRef.current && windows.length > 0) {
      scrollToEndRef.current = false
      requestAnimationFrame(() => scrollToPage(windows.length - 1))
    }
  }, [windows])

  function scrollToPage(i) {
    const pager = pagerRef.current
    if (!pager) return
    pager.scrollTo({ left: i * pager.clientWidth, behavior: 'smooth' })
  }

  function onPagerScroll() {
    const pager = pagerRef.current
    if (!pager || pager.clientWidth === 0) return
    const idx = Math.round(pager.scrollLeft / pager.clientWidth)
    if (idx !== activeIdx) setActiveIdx(Math.max(0, Math.min(idx, windows.length - 1)))
  }

  async function newWindow() {
    try {
      scrollToEndRef.current = true
      await api('/api/windows', { method: 'POST', body: {} })
      await refresh()
    } catch (err) {
      if (err.status === 401) onAuthLost()
    }
  }

  async function killWindow(win) {
    if (!confirm(`¿cerrar la ventana ${win.index} (${win.name})?`)) return
    try {
      await api(`/api/windows/${encodeURIComponent(win.id)}`, { method: 'DELETE' })
      await refresh()
    } catch (err) {
      if (err.status === 401) onAuthLost()
    }
  }

  async function renameWindow(win) {
    const name = prompt(`nuevo nombre para la ventana ${win.index}:`, win.name)?.trim()
    if (!name || name === win.name) return
    try {
      await api(`/api/windows/${encodeURIComponent(win.id)}`, { method: 'PATCH', body: { name } })
      await refresh()
    } catch (err) {
      if (err.status === 401) onAuthLost()
    }
  }

  async function pasteClipboard() {
    const win = windows[activeIdx]
    if (!win) return
    try {
      const text = await navigator.clipboard.readText()
      if (text) termsRef.current.get(win.id)?.paste(text)
    } catch {
      // permiso denegado o portapapeles vacío: nada que pegar
    }
  }

  const registerTerm = useCallback((id, termApi) => {
    if (termApi) termsRef.current.set(id, termApi)
    else termsRef.current.delete(id)
  }, [])

  const consumeMods = useCallback(() => setMods({ ctrl: false, alt: false, shift: false }), [])

  function sendKey(seq) {
    const win = windows[activeIdx]
    if (!win) return
    let out = seq
    // mods pegajosos también para teclas de la barra (shift+flecha, alt+tecla, ctrl+letra…)
    if (mods.ctrl || mods.alt || mods.shift) {
      const arrow = /^\x1b\[([ABCD])$/.exec(seq)
      if (arrow) {
        // CSI 1;N X — N codifica shift(+1), alt(+2) y ctrl(+4)
        const n = 1 + (mods.shift ? 1 : 0) + (mods.alt ? 2 : 0) + (mods.ctrl ? 4 : 0)
        out = `\x1b[1;${n}${arrow[1]}`
        consumeMods()
      } else if (seq === '\t' && mods.shift) {
        out = '\x1b[Z'
        consumeMods()
      } else if (seq.length === 1) {
        if (mods.shift) out = out.toUpperCase()
        if (mods.ctrl) {
          const c = out.toUpperCase().charCodeAt(0)
          if (c >= 63 && c <= 95) out = String.fromCharCode(c & 0x1f)
        }
        if (mods.alt) out = '\x1b' + out
        consumeMods()
      }
    }
    termsRef.current.get(win.id)?.send(out)
  }

  return (
    <div className="shell">
      <Waybar
        windows={windows}
        stats={stats}
        activeIdx={activeIdx}
        onSelect={scrollToPage}
        onNew={newWindow}
        onKill={killWindow}
        onRename={renameWindow}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="pager" ref={pagerRef} onScroll={onPagerScroll}>
        {windows.map((w, i) => (
          <div className="page" key={w.id}>
            <div className={`term-window ${i === activeIdx ? '' : 'inactive'}`}>
              <div className="term-inner">
                <TermView
                  key={`${w.id}:${transparent}`}
                  win={w}
                  registerTerm={registerTerm}
                  modsRef={modsRef}
                  consumeMods={consumeMods}
                  onAuthLost={onAuthLost}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <KeyBar
        mods={mods}
        onToggleMod={m => setMods(prev => ({ ...prev, [m]: !prev[m] }))}
        onSendKey={sendKey}
        onPaste={pasteClipboard}
      />
      {settingsOpen && (
        <SettingsSheet
          onClose={() => setSettingsOpen(false)}
          onLock={onAuthLost}
        />
      )}
    </div>
  )
}
