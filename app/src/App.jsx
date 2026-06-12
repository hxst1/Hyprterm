import { useCallback, useEffect, useState } from 'react'
import { api, getToken, clearToken } from './api.js'
import { activeHost, activeHostId, subscribe, setLocalName, LOCAL_ID } from './hosts.js'
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
  const [hostId, setHostId] = useState(activeHostId())

  const check = useCallback(async () => {
    setState('checking')
    try {
      const health = await api('/api/health', { timeoutMs: 4000 })
      if (reloadIfNewBuild(health?.build)) return
      // afina el nombre del host local con su hostname real
      if (activeHostId() === LOCAL_ID && health?.host) setLocalName(health.host)
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

  // cambiar de host activo: remonta todo el flujo contra el nuevo host.
  // Solo reacciona si cambia el host ACTIVO, no ante cualquier edición del
  // registro (añadir/quitar un host no debe reiniciar la sesión actual).
  useEffect(() => subscribe(() => {
    setHostId(prev => {
      const id = activeHostId()
      if (id !== prev) check()
      return id
    })
  }), [check])

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
          <p>comprobando si {activeHost().name} está despierto…</p>
        </div>
      </div>
    )
  }
  if (state === 'offline') return <Offline onRetry={check} host={activeHost()} />
  if (state === 'login') return <Login key={hostId} host={activeHost()} onSuccess={() => setState('desktop')} />
  return <Desktop key={hostId} onAuthLost={logout} />
}
