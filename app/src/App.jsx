import { useCallback, useEffect, useState } from 'react'
import { api, getToken, clearToken } from './api.js'
import Offline from './components/Offline.jsx'
import Login from './components/Login.jsx'
import Desktop from './components/Desktop.jsx'

// Si el server sirve un build más nuevo que este bundle, recarga (una sola vez
// por build): una PWA de iOS puede vivir días en memoria y quedarse hablando
// un protocolo viejo tras un deploy.
function reloadIfNewBuild(build) {
  if (import.meta.env.DEV || !build || build === __BUILD_ID__) return false
  if (sessionStorage.getItem('hyprterm_reloaded_for') === build) return false
  sessionStorage.setItem('hyprterm_reloaded_for', build)
  location.reload()
  return true
}

// checking → offline | login | desktop
export default function App() {
  const [state, setState] = useState('checking')

  const check = useCallback(async () => {
    setState('checking')
    try {
      const health = await api('/api/health', { timeoutMs: 4000 })
      if (reloadIfNewBuild(health?.build)) return
    } catch {
      setState('offline')
      return
    }
    if (!getToken()) {
      setState('login')
      return
    }
    try {
      await api('/api/windows')
      setState('desktop')
    } catch (err) {
      if (err.status === 401) clearToken()
      setState(err.status === 401 ? 'login' : 'offline')
    }
  }, [])

  useEffect(() => { check() }, [check])

  // al volver del background, comprueba si hay un build nuevo desplegado
  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState !== 'visible') return
      try {
        const health = await api('/api/health', { timeoutMs: 3000 })
        reloadIfNewBuild(health?.build)
      } catch { /* sin red ahora mismo: ya reintentará */ }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setState('login')
  }, [])

  if (state === 'checking') {
    return (
      <div className="shell">
        <div className="statescreen">
          <div className="glyph">⏻</div>
          <p>comprobando si tu pc está despierto…</p>
        </div>
      </div>
    )
  }
  if (state === 'offline') return <Offline onRetry={check} />
  if (state === 'login') return <Login onSuccess={() => setState('desktop')} />
  return <Desktop onAuthLost={logout} />
}
