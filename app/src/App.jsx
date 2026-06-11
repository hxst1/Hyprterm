import { useCallback, useEffect, useState } from 'react'
import { api, getToken, clearToken } from './api.js'
import Offline from './components/Offline.jsx'
import Login from './components/Login.jsx'
import Desktop from './components/Desktop.jsx'

// checking → offline | login | desktop
export default function App() {
  const [state, setState] = useState('checking')

  const check = useCallback(async () => {
    setState('checking')
    try {
      await api('/api/health', { timeoutMs: 4000 })
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
