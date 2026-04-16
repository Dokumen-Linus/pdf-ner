// docs: https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { paraglideMiddleware } from "@/integrations/paraglide/server"

export default createServerEntry({
  fetch(request) {
    return paraglideMiddleware(request, () => handler.fetch(request))
  },
})
