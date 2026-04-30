import Stripe from "stripe"

import { env } from "@/env.server"

export const STRIPE_API_VERSION = "2026-04-22.dahlia"

export function getStripe() {
  const config = { apiVersion: STRIPE_API_VERSION } as unknown as ConstructorParameters<
    typeof Stripe
  >[1]
  return new Stripe(env.STRIPE_SECRET_KEY, config)
}
