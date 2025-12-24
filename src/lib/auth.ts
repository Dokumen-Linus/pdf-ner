import { betterAuth } from "better-auth"
import { haveIBeenPwned } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { Pool } from "pg"
import { env } from "../env.server"

export const auth = betterAuth({
  database: new Pool({
    connectionString: env.AUTH_DATABASE_URL,
  }),
  advancedOptions: {
    modelName: {
      user: "auth.user",
      session: "auth.session",
      account: "auth.account",
      verification: "auth.verification",
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      console.log("Sending verification email to", user.email)
      console.log("Verification URL:", url)
    },
  },
  plugins: [
    haveIBeenPwned({
      customPasswordCompromisedMessage:
        "Password likely has been compromised. Please choose a different password.",
    }),
    tanstackStartCookies(), // tanstackStartCookies must be the last plugin in the array
  ],
})
