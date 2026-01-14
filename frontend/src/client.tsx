// docs: https://tanstack.com/start/latest/docs/framework/react/guide/client-entry-point
import { StrictMode } from "react"
import { StartClient } from "@tanstack/react-start/client"
import { hydrateRoot } from "react-dom/client"
import { ErrorBoundary } from "./components/error-boundary"

hydrateRoot(
  document,
  import.meta.env.DEV ? (
    <StrictMode>
      <ErrorBoundary>
        <StartClient />
      </ErrorBoundary>
    </StrictMode>
  ) : (
    <ErrorBoundary>
      <StartClient />
    </ErrorBoundary>
  ),
)