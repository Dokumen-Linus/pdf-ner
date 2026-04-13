import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  isServer: true,
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
    API_URL: z.string(),
    API_KEY: z.string(),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_REGION: z.string().default("us-east-1"),
    AWS_ENDPOINT_URL: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
