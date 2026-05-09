import { SESClient } from "@aws-sdk/client-ses"

import { env } from "../env.server"

export const sesClient = new SESClient({
  region: env.SES_AWS_REGION,
  ...(env.SES_AWS_ENDPOINT_URL ? { endpoint: env.SES_AWS_ENDPOINT_URL } : {}),
})
