import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_BASE_URL: z.url().optional(),
    VITE_STRIPE_PUBLISHABLE_KEY: z.string(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
})
