import { SESClient } from "@aws-sdk/client-ses"

import { env } from "../env.server"

export const sesClient = new SESClient({
  region: env.SES_AWS_REGION,
  credentials: {
    accessKeyId: env.SES_AWS_ACCESS_KEY_ID,
    secretAccessKey: env.SES_AWS_SECRET_ACCESS_KEY,
  },
  ...(env.SES_AWS_ENDPOINT_URL ? { endpoint: env.SES_AWS_ENDPOINT_URL } : {}),
})
