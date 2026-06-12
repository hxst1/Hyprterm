const KEYS = [
  { label: 'esc', seq: '\x1b' },
  { label: 'tab', seq: '\t' },
  { label: 'ctrl', mod: 'ctrl' },
  { label: 'alt', mod: 'alt' },
  { label: 'shift', mod: 'shift' },
  { label: '^c', seq: '\x03' },
  { label: '←', seq: '\x1b[D' },
  { label: '↓', seq: '\x1b[B' },
  { label: '↑', seq: '\x1b[A' },
  { label: '→', seq: '\x1b[C' },
  { label: '↵', seq: '\r' },
  { label: '|', seq: '|' },
  { label: '~', seq: '~' },
  { label: '-', seq: '-' },
  { label: '/', seq: '/' },
  { label: ':', seq: ':' }
]

export default function KeyBar({ mods, onToggleMod, onSendKey, onPaste }) {
  return (
    <div className="keybar">
      <button
        className="key"
        // pointerdown con preventDefault mantiene el teclado iOS abierto;
        // el click posterior conserva la activación de usuario que exige clipboard
        onPointerDown={e => e.preventDefault()}
        onClick={onPaste}
      >
        pegar
      </button>
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
