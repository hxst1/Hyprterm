import React from 'react'
import { createRoot } from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import './theme.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { applyTheme } from './prefs.js'

applyTheme()

// Geometría real visible: el teclado de iOS no redimensiona el layout viewport,
// reduce el visualViewport y además lo DESPLAZA (offsetTop) para enfocar el
// input. Como .shell es fixed (anclado al layout), hay que compensar ambas
// cosas o la UI se va hacia arriba, fuera de pantalla.
function syncViewport() {
  const vv = window.visualViewport
  const h = vv ? vv.height : window.innerHeight
  const t = vv ? vv.offsetTop : 0
  document.documentElement.style.setProperty('--vvh', `${Math.round(h)}px`)
  document.documentElement.style.setProperty('--vvt', `${Math.round(t)}px`)
}
window.visualViewport?.addEventListener('resize', syncViewport)
window.visualViewport?.addEventListener('scroll', syncViewport)
window.addEventListener('resize', syncViewport)
syncViewport()

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
