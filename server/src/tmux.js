import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

async function tmux(...args) {
  const { stdout } = await run('tmux', args)
  return stdout.trimEnd()
}

// HYPRTERM=1 marca las panes creadas por hyprterm para que el shell pueda
// adaptarse (p. ej. un prompt más corto en el móvil). Requiere tmux 3.2+ (-e).
export async function ensureSession(session, shell, startDir) {
  try {
    await tmux('has-session', '-t', `=${session}`)
  } catch {
    const args = ['new-session', '-d', '-s', session, '-e', 'HYPRTERM=1']
    if (startDir) args.push('-c', startDir)
    if (shell) args.push(shell)
    await tmux(...args)
  }
}

// El nombre va al final porque puede contener '|'; el resto son campos seguros.
export async function listWindows(session) {
  const out = await tmux(
    'list-windows', '-t', `=${session}`, '-F',
    '#{window_id}|#{window_index}|#{window_active}|#{pane_current_command}|#{window_name}'
  )
  if (!out) return []
  return out.split('\n').map(line => {
    const [id, index, active, command, ...nameParts] = line.split('|')
    return { id, index: Number(index), active: active === '1', command, name: nameParts.join('|') }
  })
}

export async function newWindow(session, name, shell, startDir) {
  const args = ['new-window', '-t', `=${session}`, '-e', 'HYPRTERM=1', '-P', '-F', '#{window_id}']
  if (name) args.splice(1, 0, '-n', name)
  if (startDir) args.push('-c', startDir)
  if (shell) args.push(shell)
  const id = await tmux(...args)
  return id
}

export async function killWindow(windowId) {
  await tmux('kill-window', '-t', windowId)
}

export async function renameWindow(windowId, name) {
  await tmux('rename-window', '-t', windowId, name)
}

// Sesión agrupada: comparte las ventanas de `session` pero tiene su propia
// ventana activa, así cada vista del móvil puede mirar una ventana distinta.
export async function prepareView(session, viewName, windowId) {
  await tmux('new-session', '-d', '-s', viewName, '-t', `=${session}`)
  await tmux('set-option', '-t', viewName, 'status', 'off')
  // con mouse on el scroll táctil/rueda entra en copy-mode y recorre el historial del pane
  await tmux('set-option', '-t', viewName, 'mouse', 'on')
  if (windowId !== null) {
    await tmux('select-window', '-t', `${viewName}:${windowId}`)
  }
}

export async function killView(viewName) {
  try {
    await tmux('kill-session', '-t', viewName)
  } catch {
    // ya no existe
  }
}

// Al arrancar el server, elimina vistas que quedaran huérfanas de un arranque anterior.
export async function cleanupViews() {
  let out
  try {
    out = await tmux('list-sessions', '-F', '#{session_name}')
  } catch {
    return // no hay servidor tmux corriendo
  }
  for (const name of out.split('\n')) {
    if (name.startsWith('htv_')) await killView(name)
  }
}
