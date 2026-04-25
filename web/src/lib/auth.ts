import { i18n } from "@better-auth/i18n"
import { betterAuth } from "better-auth"
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api"
import { haveIBeenPwned, organization } from "better-auth/plugins"
import { defaultAc, ownerAc } from "better-auth/plugins/organization/access"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { eq, or, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { db } from "../db/client"
import { authMembers, authOrganizations, authTeamMembers, authTeams } from "../db/schemas/auth"
import { organizations, webTeams } from "../db/schemas/web"
import { users } from "../db/schemas/web/users"
import { env } from "../env.server"

import {
  BETTER_AUTH_ERROR_REDIRECT_PATH,
  BETTER_AUTH_LOCALE_COOKIE_NAME,
  betterAuthApiErrorTranslations,
  detectAuthLocaleFromHeaders,
  getLocalizedAuthApiMessage,
} from "./auth-i18n"
import { sendEmail } from "./send-email"

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

const betterAuthMessageI18nPlugin = {
  id: "dokumen-better-auth-message-i18n",
  version: "1.0.0",
  hooks: {
    after: [
      {
        matcher: () => true,
        handler: createAuthMiddleware(async (ctx) => {
          const returned = ctx.context.returned
          if (!isAPIError(returned) || typeof returned.body?.code === "string") {
            return
          }

          const locale = detectAuthLocaleFromHeaders(ctx.headers)
          const translation = getLocalizedAuthApiMessage(returned.message, locale)
          if (!translation || translation === returned.message) {
            return
          }

          throw new APIError(returned.status, {
            message: translation,
            originalMessage: returned.message,
          })
        }),
      },
    ],
  },
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

  await db.insert(organizations).values({ id: organizationId, createdAt })
  await db.insert(webTeams).values({ id: teamId, organizationId, createdAt })
  await db.update(users).set({ organizationId }).where(eq(users.id, user.id))
}

export const auth = betterAuth({
  database: authDatabase,
  trustedOrigins,
  onAPIError: {
    errorURL: BETTER_AUTH_ERROR_REDIRECT_PATH,
  },
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
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        template: "reset-password",
        props: { name: user.name, url },
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        template: "verify-email",
        props: { name: user.name, url },
      })
    },
  },
  plugins: [
    i18n({
      translations: betterAuthApiErrorTranslations,
      defaultLocale: "en",
      detection: ["cookie", "header"],
      localeCookie: BETTER_AUTH_LOCALE_COOKIE_NAME,
    }),
    betterAuthMessageI18nPlugin,
    haveIBeenPwned(),
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
      organizationHooks: {
        afterCreateOrganization: async ({ organization }) => {
          await db.insert(organizations).values({
            id: organization.id,
            createdAt: new Date(organization.createdAt),
          })
        },
        afterCreateTeam: async ({ team }) => {
          await db.insert(webTeams).values({
            id: team.id,
            organizationId: team.organizationId,
            createdAt: new Date(team.createdAt),
          })
        },
      },
      async sendInvitationEmail(data) {
        const acceptUrl = `${env.BETTER_AUTH_URL}/accept-invitation/${data.id}`
        await sendEmail({
          to: data.email,
          template: "organization-invitation",
          props: {
            invitedByName: data.inviter.user.name,
            organizationName: data.organization.name,
            url: acceptUrl,
          },
        })
      },
    }),
    tanstackStartCookies(), // tanstackStartCookies must be the last plugin in the array
  ],
})
