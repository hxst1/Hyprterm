const KEYS = [
  { label: 'esc', seq: '\x1b' },
  { label: 'tab', seq: '\t' },
  { label: 'ctrl', mod: 'ctrl' },
  { label: 'alt', mod: 'alt' },
  { label: '^c', seq: '\x03' },
  { label: '←', seq: '\x1b[D' },
  { label: '↓', seq: '\x1b[B' },
  { label: '↑', seq: '\x1b[A' },
  { label: '→', seq: '\x1b[C' },
  { label: '|', seq: '|' },
  { label: '~', seq: '~' },
  { label: '-', seq: '-' },
  { label: '/', seq: '/' },
  { label: ':', seq: ':' }
]

export default function KeyBar({ mods, onToggleMod, onSendKey }) {
  return (
    <div className="keybar">
      {KEYS.map(k =>
        k.mod ? (
          <button
            key={k.label}
            className={`key ${mods[k.mod] ? 'sticky-on' : ''}`}
            // pointerdown para no robar el foco del terminal (el teclado iOS no se cierra)
            onPointerDown={e => { e.preventDefault(); onToggleMod(k.mod) }}
          >
            {k.label}
          </button>
        ) : (
          <button
            key={k.label}
            className="key"
            onPointerDown={e => { e.preventDefault(); onSendKey(k.seq) }}
          >
            {k.label}
          </button>
        )
      )}
    </div>
  )
}
