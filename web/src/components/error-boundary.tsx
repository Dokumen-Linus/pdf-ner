import { Component, type ReactNode } from "react"
import { m } from "@/integrations/paraglide/messages.js"

type ErrorBoundaryProps = {
  children: ReactNode
  fallback?: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) console.error("Unhandled client error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              padding: "2rem",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <h2>{m.error_title()}</h2>
            <p>{m.error_description()}</p>

            {import.meta.env.DEV && this.state.error && (
              <pre
                style={{
                  marginTop: "1rem",
                  color: "#b91c1c",
                  whiteSpace: "pre-wrap",
                }}
              >
                {this.state.error.stack}
              </pre>
            )}
          </div>
        )
      )
    }

    return this.props.children
  }
}
