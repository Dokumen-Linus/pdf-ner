import { betterAuth } from "better-auth"
import { haveIBeenPwned, organization } from "better-auth/plugins"
import { defaultAc, ownerAc } from "better-auth/plugins/organization/access"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { eq, or, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { db } from "../db/client"
import { authMembers, authOrganizations, authTeamMembers, authTeams } from "../db/schemas/auth"
import { users } from "../db/schemas/web/users"
import { env } from "../env.server"
import { resendClient } from "../integrations/resend"

const trustedOrigins = [
  env.BETTER_AUTH_URL,
  process.env.BASE_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter((origin): origin is string => Boolean(origin))

const authDatabase = new Pool({
  connectionString: env.AUTH_DATABASE_URL,
})

const authDb = drizzle(authDatabase, {
  schema: {
    authOrganizations,
    authMembers,
    authTeams,
    authTeamMembers,
  },
})

const developerAc = defaultAc.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["read"],
})

const analystAc = defaultAc.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"],
})

type BetterAuthUserRecord = {
  id: string
  email: string
  name: string
  image?: string | null
}

function getDefaultWorkspaceName(user: BetterAuthUserRecord): string {
  const name = user.name.trim()
  if (name.length > 0) return `${name}'s workspace`
  const emailPrefix = user.email.split("@")[0]?.trim()
  if (emailPrefix) return `${emailPrefix}'s workspace`
  return "Personal workspace"
}

function getDefaultWorkspaceSlug(user: BetterAuthUserRecord): string {
  return `workspace-${user.id.slice(0, 8).toLowerCase()}`
}

async function syncWebUserFromAuth(user: BetterAuthUserRecord) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.authUserId, user.id), eq(users.email, user.email)))
    .limit(1)

  const nextUserData = {
    authUserId: user.id,
    email: user.email,
    displayName: user.name.trim() || null,
    avatarUrl: user.image ?? null,
  }

  if (existing) {
    await db.update(users).set(nextUserData).where(eq(users.id, existing.id))
    return existing.id
  }

  await db.insert(users).values({
    id: user.id,
    ...nextUserData,
  })

  return user.id
}

async function deleteWebUserForAuthUser(authUserId: string) {
  await db
    .delete(users)
    .where(or(eq(users.authUserId, authUserId), sql`${users.id}::text = ${authUserId}`))
}

async function ensureDefaultWorkspaceForUser(user: BetterAuthUserRecord) {
  const [existingMember] = await authDb
    .select({ id: authMembers.id })
    .from(authMembers)
    .where(eq(authMembers.userId, user.id))
    .limit(1)

  if (existingMember) {
    return
  }

  const organizationId = crypto.randomUUID()
  const teamId = crypto.randomUUID()
  const workspaceName = getDefaultWorkspaceName(user)
  const workspaceSlug = getDefaultWorkspaceSlug(user)
  const createdAt = new Date()

  await authDb.transaction(async (tx) => {
    await tx.insert(authOrganizations).values({
      id: organizationId,
      name: workspaceName,
      slug: workspaceSlug,
      createdAt,
      metadata: JSON.stringify({ plan: "base", autoProvisioned: true }),
    })

    await tx.insert(authMembers).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: user.id,
      role: "owner",
      createdAt,
    })

    await tx.insert(authTeams).values({
      id: teamId,
      name: "Workspace",
      organizationId,
      createdAt,
      updatedAt: createdAt,
    })

    await tx.insert(authTeamMembers).values({
      id: crypto.randomUUID(),
      teamId,
      userId: user.id,
      createdAt,
    })
  })
}

export const auth = betterAuth({
  database: authDatabase,
  trustedOrigins,
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    modelName: {
      user: "auth.user",
      session: "auth.session",
      account: "auth.account",
      verification: "auth.verification",
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const authUser = user as BetterAuthUserRecord
          await syncWebUserFromAuth(authUser)
          await ensureDefaultWorkspaceForUser(authUser)
        },
      },
      update: {
        after: async (user) => {
          await syncWebUserFromAuth(user as BetterAuthUserRecord)
        },
      },
      delete: {
        after: async (user) => {
          await deleteWebUserForAuthUser(user.id)
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
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
      roles: {
        owner: ownerAc,
        developer: developerAc,
        analyst: analystAc,
      },
      teams: {
        enabled: true,
      },
      schema: {
        organization: { modelName: "auth.organization" },
        member: { modelName: "auth.member" },
        invitation: { modelName: "auth.invitation" },
        team: { modelName: "auth.team" },
        teamMember: { modelName: "auth.teamMember" },
      },
    }),
    tanstackStartCookies(), // tanstackStartCookies must be the last plugin in the array
  ],
})
