import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),
    AUTH_DATABASE_URL: z.string(),
    WEB_DATABASE_URL: z.string(),
    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.url(),
    RESEND_API_KEY: z.string(),
    FROM_EMAIL: z.email(),
    MY_EMAIL: z.email(),
    UPLOADTHING_TOKEN: z.string(),
    STRIPE_SECRET_KEY: z.string(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
