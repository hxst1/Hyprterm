import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { termWsUrl } from '../api.js'

const THEME = {
  background: '#00000000',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#45475a',
  black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
  blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
  brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5', brightWhite: '#a6adc8'
}

// Aplica Ctrl/Alt pegajosos al siguiente carácter tecleado
function applyMods(data, mods) {
  let out = data
  if (mods.ctrl && data.length === 1) {
    if (data === ' ') out = '\x00'
    else {
      const c = data.toUpperCase().charCodeAt(0)
      if (c >= 63 && c <= 95) out = String.fromCharCode(c & 0x1f)
    }
  }
  if (mods.alt) out = '\x1b' + out
  return out
}

export default function TermView({ win, registerTerm, modsRef, consumeMods, onAuthLost }) {
  const holderRef = useRef(null)

  useEffect(() => {
    const term = new Terminal({
      theme: THEME,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
      allowTransparency: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(holderRef.current)
    fit.fit()

    let ws = null
    let closed = false
    let retry = 0

    function send(data) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    }

    function connect() {
      if (closed) return
      ws = new WebSocket(termWsUrl(win.index, term.cols, term.rows))
      ws.onopen = () => { retry = 0 }
      ws.onmessage = e => term.write(e.data)
      ws.onclose = ev => {
        if (closed) return
        if (ev.code === 4001) { onAuthLost(); return }
        const wait = Math.min(8000, 500 * 2 ** retry)
        retry += 1
        term.write(`\r\n\x1b[2m· conexión perdida, reintento en ${Math.round(wait / 1000)}s…\x1b[0m\r\n`)
        setTimeout(connect, wait)
      }
    }
    connect()

    term.onData(data => {
      const mods = modsRef.current
      if (mods.ctrl || mods.alt) {
        send(applyMods(data, mods))
        consumeMods()
      } else {
        send(data)
      }
    })

    const ro = new ResizeObserver(() => {
      fit.fit()
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    })
    ro.observe(holderRef.current)

    registerTerm(win.id, { send, focus: () => term.focus() })

    return () => {
      closed = true
      ro.disconnect()
      registerTerm(win.id, null)
      ws?.close()
      term.dispose()
    }
    // win.index solo se usa al conectar; la identidad de la ventana es win.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.id])

  return <div ref={holderRef} style={{ height: '100%', width: '100%' }} />
}
