import { useEffect, useState } from 'react'

export default function Offline({ onRetry, host }) {
  const [count, setCount] = useState(8)

  useEffect(() => {
    if (count <= 0) {
      onRetry()
      return
    }
    const t = setTimeout(() => setCount(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [count, onRetry])

  const name = host?.name ?? 'tu pc'
  return (
    <div className="shell">
      <div className="statescreen">
        <div className="glyph">󰍃 ⏻</div>
        <h1>{name} offline</h1>
        <p>
          no llego a {name}. ¿está encendido?<br />
          ¿tailscale activo en el iphone?
        </p>
        <button className="btn" onClick={onRetry}>reintentar ({count})</button>
      </div>
    </div>
  )
}
