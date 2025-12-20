// docs: https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request)
  },
})
