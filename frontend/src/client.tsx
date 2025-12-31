// docs: https://tanstack.com/start/latest/docs/framework/react/guide/client-entry-point
import { StrictMode } from "react"
import { StartClient } from "@tanstack/react-start/client"
import { hydrateRoot } from "react-dom/client"

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>,
)
