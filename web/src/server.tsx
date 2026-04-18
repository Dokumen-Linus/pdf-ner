// docs: https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"

import { paraglideMiddleware } from "@/integrations/paraglide/server"
import { withObservedRequest, withObservedResponse } from "@/lib/observability/fetch.server"

export default createServerEntry({
  fetch(request) {
    const observed = withObservedRequest(request)
    return paraglideMiddleware(observed.request, async () => {
      const response = await handler.fetch(observed.request)
      return withObservedResponse(response, observed.requestId)
    })
  },
})
