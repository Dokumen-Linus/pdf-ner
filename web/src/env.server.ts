import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

type SecretRecord = Record<string, string | undefined>

const secretCache = new Map<string, SecretRecord>()

async function loadSecretJson(secretId: string, region: string): Promise<SecretRecord> {
  const cacheKey = `${region}:${secretId}`
  const cached = secretCache.get(cacheKey)
  if (cached) return { ...cached }

  const client = new SecretsManagerClient({ region })
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }))
  if (!response.SecretString) {
    throw new Error(`AWS secret ${secretId} must contain SecretString JSON`)
  }

  const parsed: unknown = JSON.parse(response.SecretString)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`AWS secret ${secretId} must be a JSON object`)
  }

  const values = Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [
      key,
      value === null || value === undefined ? undefined : String(value),
    ]),
  )
  secretCache.set(cacheKey, values)
  return { ...values }
}

async function loadStageGroups(groups: Array<"web" | "email">): Promise<SecretRecord> {
  const stage = process.env.SECRETS_STAGE
  if (!stage) return {}

  const region = process.env.AWS_REGION
  if (!region) throw new Error("AWS_REGION is required when SECRETS_STAGE is set")

  const values: SecretRecord = {}
  for (const group of groups) {
    Object.assign(values, await loadSecretJson(`${stage}/${group}`, region))
  }
  return values
}

const runtimeEnv = {
  ...process.env,
  ...(await loadStageGroups(["web", "email"])),
}

export const env = createEnv({
  isServer: true,
  server: {
    DATABASE_URL: z.string(),
    AUTH_DATABASE_URL: z.string(),
    WEB_DATABASE_URL: z.string(),
    BASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.url(),
    FROM_EMAIL: z.email(),
    MY_EMAIL: z.email(),
    STRIPE_SECRET_KEY: z.string(),
    API_URL: z.string(),
    API_KEY: z.string(),
    HEALTHCHECK_TOKEN: z.string().optional(),
    SES_AWS_ACCESS_KEY_ID: z.string(),
    SES_AWS_SECRET_ACCESS_KEY: z.string(),
    SES_AWS_REGION: z.string().default("us-east-1"),
    SES_AWS_ENDPOINT_URL: z.string().optional(),
    PDF_STORAGE_AWS_ACCESS_KEY_ID: z.string(),
    PDF_STORAGE_AWS_SECRET_ACCESS_KEY: z.string(),
    PDF_STORAGE_AWS_REGION: z.string().default("us-east-1"),
    PDF_STORAGE_AWS_ENDPOINT_URL: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
  },
  runtimeEnv,
  emptyStringAsUndefined: true,
})
