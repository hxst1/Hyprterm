import React from 'react'
import { createRoot } from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import './theme.css'
import App from './App.jsx'
import { applyTheme } from './prefs.js'

applyTheme()

// Altura real visible (el teclado de iOS reduce el visualViewport, no el layout)
function syncViewportHeight() {
  const vv = window.visualViewport
  const h = vv ? vv.height : window.innerHeight
  document.documentElement.style.setProperty('--vvh', `${Math.round(h)}px`)
}
window.visualViewport?.addEventListener('resize', syncViewportHeight)
window.addEventListener('resize', syncViewportHeight)
syncViewportHeight()

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

createRoot(document.getElementById('root')).render(<App />)
