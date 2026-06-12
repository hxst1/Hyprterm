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

const FONT_FAMILY = "'JetBrainsMono Nerd Font Mono', monospace"

// Aplica Ctrl/Alt/Shift pegajosos al siguiente carácter tecleado
function applyMods(data, mods) {
  let out = data
  if (out.length === 1) {
    if (mods.shift) out = out.toUpperCase()
    if (mods.ctrl) {
      if (out === ' ') out = '\x00'
      else {
        const c = out.toUpperCase().charCodeAt(0)
        if (c >= 63 && c <= 95) out = String.fromCharCode(c & 0x1f)
      }
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
      // arranca con la fuente del sistema; al cargar la Nerd Font se cambia y re-mide
      fontFamily: 'monospace',
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
    let retryTimer = null

    document.fonts.load(`13px 'JetBrainsMono Nerd Font Mono'`).then(() => {
      if (closed) return
      term.options.fontFamily = FONT_FAMILY
      fit.fit()
    })

    function send(data) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    }

    function scheduleRetry() {
      const wait = Math.min(8000, 500 * 2 ** retry)
      retry += 1
      term.write(`\r\n\x1b[2m· conexión perdida, reintento en ${Math.round(wait / 1000)}s…\x1b[0m\r\n`)
      retryTimer = setTimeout(connect, wait)
    }

    async function connect() {
      if (closed) return
      let url
      try {
        // reconecta por win.id (estable) — el índice puede cambiar si se cierran ventanas
        url = await termWsUrl(win.id, term.cols, term.rows)
      } catch (err) {
        if (err.status === 401) { onAuthLost(); return }
        if (!closed) scheduleRetry()
        return
      }
      if (closed) return
      ws = new WebSocket(url)
      ws.onopen = () => { retry = 0 }
      ws.onmessage = e => term.write(e.data)
      ws.onclose = () => {
        if (closed) return
        // 4001 = ticket caducado/no válido: al reintentar se pide otro;
        // si el token ya no vale, el propio fetch del ticket dará 401
        scheduleRetry()
      }
    }
    connect()

    term.onData(data => {
      const mods = modsRef.current
      if (mods.ctrl || mods.alt || mods.shift) {
        send(applyMods(data, mods))
        consumeMods()
      } else {
        send(data)
      }
    })

    // Scroll táctil: xterm.js solo soporta rueda de ratón. Convertimos el gesto
    // en eventos de rueda sintéticos para que siga su pipeline normal: con el
    // mouse-tracking de tmux activo se traducen a scroll de copy-mode (historial
    // real del pane), y sin tracking caen en el scrollback local de xterm.
    const holder = holderRef.current
    let touchY = null
    const onTouchStart = e => { touchY = e.touches[0].clientY }
    const onTouchMove = e => {
      if (touchY === null) return
      const t = e.touches[0]
      const dy = touchY - t.clientY
      touchY = t.clientY
      if (!dy) return
      holder.querySelector('.xterm-viewport')?.dispatchEvent(new WheelEvent('wheel', {
        deltaY: dy,
        deltaMode: 0,
        clientX: t.clientX,
        clientY: t.clientY,
        bubbles: true,
        cancelable: true
      }))
    }
    const onTouchEnd = () => { touchY = null }
    holder.addEventListener('touchstart', onTouchStart, { passive: true })
    holder.addEventListener('touchmove', onTouchMove, { passive: true })
    holder.addEventListener('touchend', onTouchEnd)

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
      clearTimeout(retryTimer)
      holder.removeEventListener('touchstart', onTouchStart)
      holder.removeEventListener('touchmove', onTouchMove)
      holder.removeEventListener('touchend', onTouchEnd)
      ro.disconnect()
      registerTerm(win.id, null)
      ws?.close()
      term.dispose()
    }
    // la identidad de la ventana es win.id; el resto de props son refs estables
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.id])

  return <div ref={holderRef} style={{ height: '100%', width: '100%' }} />
}
