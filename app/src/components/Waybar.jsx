import { useEffect, useState } from 'react'
import { api } from '../api.js'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(t)
  }, [])
  return now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function useStats() {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    let alive = true
    async function poll() {
      try {
        const s = await api('/api/stats')
        if (alive) setStats(s)
      } catch { /* sin stats no pasa nada */ }
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return stats
}

export default function Waybar({ windows, activeIdx, onSelect, onNew, onKill }) {
  const clock = useClock()
  const stats = useStats()
  const memPct = stats ? Math.round((stats.mem.used / stats.mem.total) * 100) : null

  return (
    <div className="waybar">
      <div className="workspaces">
        {windows.map((w, i) => (
          <button
            key={w.id}
            className={`ws-chip ${i === activeIdx ? 'active' : ''}`}
            onClick={() => (i === activeIdx ? null : onSelect(i))}
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
      </div>
    </div>
  )
}
