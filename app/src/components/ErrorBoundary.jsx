import { Component } from 'react'

// Red de seguridad: un fallo dentro de una terminal (p. ej. al destruirse un
// addon) no debe dejar la app entera en negro. Aísla el subárbol y ofrece
// recargar sin perder la sesión (las ventanas viven en tmux).
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('error en la UI:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="shell">
        <div className="statescreen">
          <div className="glyph">⚠</div>
          <h1>algo se rompió en la interfaz</h1>
          <p>tu sesión sigue viva en tmux. recarga para volver.</p>
          <button className="btn" onClick={() => location.reload()}>recargar</button>
        </div>
      </div>
    )
  }
}
