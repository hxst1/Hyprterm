import { useEffect, useRef, useState } from 'react'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(t)
  }, [])
  return now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

// stats llegan por props desde el WS de control (Desktop) — la waybar ya no sondea
export default function Waybar({ windows, stats, activeIdx, onSelect, onNew, onKill, onRename, onSettings }) {
  const clock = useClock()
  const memPct = stats ? Math.round((stats.mem.used / stats.mem.total) * 100) : null

  // long-press sobre el chip activo = renombrar ventana
  const lp = useRef({ timer: null, fired: false })
  function pressStart(w, isActive) {
    if (!isActive) return
    lp.current.fired = false
    lp.current.timer = setTimeout(() => {
      lp.current.fired = true
      onRename(w)
    }, 550)
  }
  function pressEnd() {
    clearTimeout(lp.current.timer)
  }

  return (
    <div className="waybar">
      <div className="workspaces">
        {windows.map((w, i) => (
          <button
            key={w.id}
            className={`ws-chip ${i === activeIdx ? 'active' : ''}`}
            onClick={() => {
              if (lp.current.fired) { lp.current.fired = false; return }
              if (i !== activeIdx) onSelect(i)
            }}
            onPointerDown={() => pressStart(w, i === activeIdx)}
            onPointerUp={pressEnd}
            onPointerLeave={pressEnd}
            onPointerCancel={pressEnd}
            onContextMenu={e => e.preventDefault()}
          >
            <span>{w.index}</span>
            <span style={{ opacity: 0.8 }}>{w.command || w.name}</span>
            {i === activeIdx && windows.length > 1 && (
              <span
                className="close-x"
                onClick={e => { e.stopPropagation(); onKill(w) }}
              >
                ✕
              </span>
            )}
          </button>
        ))}
        <button className="ws-chip add" onClick={onNew}>+</button>
      </div>
      <div className="modules">
        {stats && <span className="mod cpu">cpu <b>{stats.cpu}%</b></span>}
        {memPct !== null && <span className="mod mem">mem <b>{memPct}%</b></span>}
        {stats?.battery && (
          <span className="mod bat">
            bat <b>{stats.battery.capacity}%{stats.battery.charging ? '⚡' : ''}</b>
          </span>
        )}
        <span className="mod clock">{clock}</span>
        <button className="gear" onClick={onSettings} aria-label="ajustes">⚙</button>
      </div>
    </div>
  )
}
