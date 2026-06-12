import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { termWsUrl } from '../api.js'
import { xtermTheme, fontSize, subscribe } from '../prefs.js'

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
      theme: xtermTheme(),
      // arranca con la fuente del sistema; al cargar la Nerd Font se cambia y re-mide
      fontFamily: 'monospace',
      fontSize: fontSize(),
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true // lo exige addon-unicode11
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    // anchos correctos de glifos Nerd Font / emoji
    term.loadAddon(new Unicode11Addon())
    term.unicode.activeVersion = '11'
    // URLs tappables (target _blank)
    term.loadAddon(new WebLinksAddon((_e, uri) => window.open(uri, '_blank')))
    term.open(holderRef.current)
    // renderer WebGL si la GPU lo permite; si no, se queda el DOM renderer
    let webgl = null
    try {
      webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch { /* sin WebGL */ }
    fit.fit()

    let ws = null
    let closed = false
    let retry = 0
    let retryTimer = null

    function doFit() {
      fit.fit()
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    }

    // tema y tamaño de fuente reactivos desde ajustes
    const unsubscribePrefs = subscribe(() => {
      term.options.theme = xtermTheme()
      if (term.options.fontSize !== fontSize()) {
        term.options.fontSize = fontSize()
        doFit()
      }
    })

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
    // VERTICAL en eventos de rueda sintéticos (que con mouse-tracking de tmux
    // entran en copy-mode y sin él caen en el scrollback local) y cancelamos el
    // evento para que la página no se mueva: la UI es estática, solo scrollea la
    // terminal. El gesto HORIZONTAL se deja pasar para el deslizamiento entre
    // terminales del pager.
    const holder = holderRef.current
    let startX = 0, startY = 0, lastY = 0
    let axis = null // null = sin decidir, 'v' = vertical, 'h' = horizontal
    const onTouchStart = e => {
      const t = e.touches[0]
      startX = t.clientX; startY = t.clientY; lastY = t.clientY
      axis = null
    }
    const onTouchMove = e => {
      const t = e.touches[0]
      if (axis === null) {
        const dx = Math.abs(t.clientX - startX)
        const dy = Math.abs(t.clientY - startY)
        if (dx < 8 && dy < 8) return // aún no hay dirección clara
        axis = dy >= dx ? 'v' : 'h'
      }
      if (axis === 'h') return // deslizamiento del pager: dejar el scroll nativo
      // vertical: scrollea la terminal y bloquea el scroll de la página
      if (e.cancelable) e.preventDefault()
      const dy = lastY - t.clientY
      lastY = t.clientY
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
    const onTouchEnd = () => { axis = null }
    holder.addEventListener('touchstart', onTouchStart, { passive: true })
    // passive:false para poder preventDefault y mantener la página estática
    holder.addEventListener('touchmove', onTouchMove, { passive: false })
    holder.addEventListener('touchend', onTouchEnd)

    const ro = new ResizeObserver(doFit)
    ro.observe(holderRef.current)

    registerTerm(win.id, {
      send,
      // term.paste respeta el bracketed paste mode de la app del pane
      paste: text => term.paste(text),
      focus: () => term.focus()
    })

    return () => {
      closed = true
      clearTimeout(retryTimer)
      unsubscribePrefs()
      holder.removeEventListener('touchstart', onTouchStart)
      holder.removeEventListener('touchmove', onTouchMove)
      holder.removeEventListener('touchend', onTouchEnd)
      ro.disconnect()
      registerTerm(win.id, null)
      ws?.close()
      // el WebGL debe soltarse antes que el Terminal: si lo destruye term.dispose()
      // su renderer ya no existe y lanza (_isDisposed), tumbando el árbol React
      try { webgl?.dispose() } catch { /* ya dispuesto */ }
      term.dispose()
    }
    // la identidad de la ventana es win.id; el resto de props son refs estables
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.id])

  return <div ref={holderRef} style={{ height: '100%', width: '100%' }} />
}
