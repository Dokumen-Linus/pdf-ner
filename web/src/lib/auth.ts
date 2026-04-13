import { betterAuth } from "better-auth"
import { haveIBeenPwned, organization } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { Pool } from "pg"
import { env } from "../env.server"
import { resendClient } from "../integrations/resend"

const trustedOrigins = [
  env.BETTER_AUTH_URL,
  process.env.BASE_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter((origin): origin is string => Boolean(origin))

export const auth = betterAuth({
  database: new Pool({
    connectionString: env.AUTH_DATABASE_URL,
  }),
  trustedOrigins,
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
      await resendClient.emails.send({
        from: env.FROM_EMAIL,
        to: user.email,
        subject: "Verify your email address",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to Dokumen AI!</h2>
            <p>Hi ${user.name || "there"},</p>
            <p>Thank you for signing up! Please click the link below to verify your email address:</p>
            <div style="margin: 30px 0;">
              <a href="${url}" style="background-color: #007cba; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${url}</p>
            <p>This link will expire in 24 hours.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        `,
      })
    },
  },
  plugins: [
    haveIBeenPwned({
      customPasswordCompromisedMessage:
        "Password likely has been compromised. Please choose a different password.",
    }),
    organization({
      teams: {
        enabled: true,
      },
      schema: {
        organization: { modelName: "auth.organization" },
        member: { modelName: "auth.member" },
        invitation: { modelName: "auth.invitation" },
        team: { modelName: "auth.team" },
      },
    }),
    tanstackStartCookies(), // tanstackStartCookies must be the last plugin in the array
  ],
})
