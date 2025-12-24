import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    BETTER_AUTH_URL: z.url(),
    DATABASE_URL: z.string(),
    APP_DATABASE_URL: z.string(),
    AUTH_DATABASE_URL: z.string(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
