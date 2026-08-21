import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'

/** ⚠️ Must be a CLASS component. There is no hook equivalent of `componentDidCatch` — this is
 *  the one thing React still requires a class for. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Where a real app reports to Sentry. Logging the component stack is what makes an error in
    // a deeply nested list findable at all.
    console.error('Render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Something broke on this page</h1>
        <p className="text-sm text-ink-600">{this.state.error.message}</p>
        {/* A full reload, not setState({error: null}) — the component tree that threw is very
            likely still in the state that made it throw. */}
        <Button onClick={() => window.location.reload()}>Reload the page</Button>
      </div>
    )
  }
}
