import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import Waybar from './Waybar.jsx'
import TermView from './TermView.jsx'
import KeyBar from './KeyBar.jsx'

export default function Desktop({ onAuthLost }) {
  const [windows, setWindows] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [mods, setMods] = useState({ ctrl: false, alt: false })

  const pagerRef = useRef(null)
  const termsRef = useRef(new Map())
  const modsRef = useRef(mods)
  modsRef.current = mods
  const scrollToEndRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const ws = await api('/api/windows')
      setWindows(prev => {
        const same = prev.length === ws.length &&
          prev.every((w, i) => w.id === ws[i].id && w.name === ws[i].name && w.command === ws[i].command)
        return same ? prev : ws
      })
    } catch (err) {
      if (err.status === 401) onAuthLost()
    }
  }, [onAuthLost])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [refresh])

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

  const registerTerm = useCallback((id, termApi) => {
    if (termApi) termsRef.current.set(id, termApi)
    else termsRef.current.delete(id)
  }, [])

  const consumeMods = useCallback(() => setMods({ ctrl: false, alt: false }), [])

  function sendKey(seq) {
    const win = windows[activeIdx]
    if (!win) return
    let out = seq
    // mods pegajosos también para teclas de la barra (alt+tecla, ctrl+letra)
    if ((mods.ctrl || mods.alt) && seq.length === 1) {
      if (mods.ctrl) {
        const c = seq.toUpperCase().charCodeAt(0)
        if (c >= 63 && c <= 95) out = String.fromCharCode(c & 0x1f)
      }
      if (mods.alt) out = '\x1b' + out
      consumeMods()
    }
    termsRef.current.get(win.id)?.send(out)
  }

  return (
    <div className="shell">
      <Waybar
        windows={windows}
        activeIdx={activeIdx}
        onSelect={scrollToPage}
        onNew={newWindow}
        onKill={killWindow}
      />
      <div className="pager" ref={pagerRef} onScroll={onPagerScroll}>
        {windows.map((w, i) => (
          <div className="page" key={w.id}>
            <div className={`term-window ${i === activeIdx ? '' : 'inactive'}`}>
              <div className="term-inner">
                <TermView
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
      />
    </div>
  )
}
