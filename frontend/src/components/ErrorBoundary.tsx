import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }

  componentDidCatch(error: Error) {
    useEditorStore.getState().log(`Application crash: ${error.message}`, 'error')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 bg-bg-base text-text-primary p-8 text-center">
          <AlertTriangle size={48} className="text-error opacity-60" />
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-text-secondary max-w-md">{this.state.error}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload() }}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
          >
            Reload Application
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
