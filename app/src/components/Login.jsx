import { useRef, useState } from 'react'
import { api, setToken } from '../api.js'

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  async function submit(e) {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError('')
    try {
      const { token, ttlMs } = await api('/api/login', { method: 'POST', body: { password } })
      setToken(token, ttlMs)
      onSuccess()
    } catch (err) {
      if (err.status === 429) {
        setError(`demasiados intentos — espera ${Math.ceil((err.body?.retryMs ?? 5000) / 1000)}s`)
      } else if (err.status === 401) {
        setError('contraseña incorrecta')
      } else {
        setError('error de conexión')
      }
      setPassword('')
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shell">
      <div className="statescreen">
        <h1>hyprterm</h1>
        <p>tu pc está despierto. identifícate.</p>
        <form className={`fakeprompt ${error ? 'error' : ''}`} onSubmit={submit}>
          <span className="ps1">❯</span>
          <input
            ref={inputRef}
            type="password"
            autoFocus
            placeholder="contraseña"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={busy}
          />
        </form>
        <div className="errmsg">{error}</div>
      </div>
    </div>
  )
}
