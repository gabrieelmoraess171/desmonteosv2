import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean }

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro inesperado na interface:', error, info)
  }

  handleReload = () => window.location.reload()

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <section className="glass-panel w-full max-w-lg p-8 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan">Desmonte OS</p>
          <h1 className="mb-3 text-2xl font-bold text-ink">Tivemos uma instabilidade momentânea</h1>
          <p className="mb-6 text-muted">A tela não conseguiu carregar corretamente. Seus dados continuam preservados.</p>
          <button className="rounded-xl bg-accent px-5 py-3 font-semibold text-white transition hover:brightness-110" onClick={this.handleReload}>
            Recarregar página
          </button>
        </section>
      </main>
    )
  }
}
