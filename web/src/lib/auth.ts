import { i18n } from "@better-auth/i18n"
import { betterAuth } from "better-auth"
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api"
import { haveIBeenPwned, organization } from "better-auth/plugins"
import { defaultAc, ownerAc } from "better-auth/plugins/organization/access"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { eq } from "drizzle-orm"
import { Pool } from "pg"

import { db } from "../db/client"
import { authMembers } from "../db/schemas/auth"
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
  env.BASE_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter((origin): origin is string => Boolean(origin))

const authDatabase = new Pool({
  connectionString: env.AUTH_DATABASE_URL,
})

const adminAc = defaultAc.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["read"],
})

const developerAc = defaultAc.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
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

type OrganizationAccountRole = "admin" | "developer" | "analyst"

function normalizeOrganizationRole(role: unknown): OrganizationAccountRole {
  const rawRole = Array.isArray(role) ? role[0] : String(role ?? "")
  const roleName = rawRole.split(",")[0]?.trim()
  if (roleName === "admin" || roleName === "developer" || roleName === "analyst") {
    return roleName
  }
  return "admin"
}

function isAdminLikeOrganizationRole(role: unknown) {
  const roles = Array.isArray(role) ? role : String(role ?? "").split(",")
  return roles.some((value) => value.trim() === "admin" || value.trim() === "owner")
}

function addOneMonth(date: Date) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1)
  return next
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
    .where(eq(users.id, user.id))
    .limit(1)

  const nextUserData = {
    email: user.email,
    displayName: user.name.trim() || null,
    avatarUrl: user.image ?? null,
  }

  if (existing) {
    await db.update(users).set(nextUserData).where(eq(users.id, existing.id))
    return existing.id
  }

  const createdAt = new Date()
  await db.insert(users).values({
    id: user.id,
    ...nextUserData,
    billingStartedAt: createdAt,
    nextPaymentAt: addOneMonth(createdAt),
    billingStatus: "stripe_info_missing",
    createdAt,
  })

  return user.id
}

async function syncWebUserForOrganizationMember({
  authUser,
  organizationId,
  role,
}: {
  authUser: BetterAuthUserRecord
  organizationId: string
  role: unknown
}) {
  const webUserId = await syncWebUserFromAuth(authUser)
  await db
    .update(users)
    .set({
      organizationId,
      role: normalizeOrganizationRole(role),
      stripeCustomerId: null,
      stripePaymentMethodId: null,
      billingStartedAt: null,
      nextPaymentAt: null,
      lastPaymentAt: null,
      billingStatus: "stripe_info_missing",
      billingFailureCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(users.id, webUserId))
}

async function assertOrganizationWillKeepAdmin({
  organizationId,
  memberId,
  currentRole,
  nextRole,
}: {
  organizationId: string
  memberId: string
  currentRole: unknown
  nextRole?: unknown
}) {
  if (!isAdminLikeOrganizationRole(currentRole)) return
  if (nextRole && isAdminLikeOrganizationRole(nextRole)) return

  const rows = await db
    .select({ id: authMembers.id, role: authMembers.role })
    .from(authMembers)
    .where(eq(authMembers.organizationId, organizationId))
  const hasAnotherAdmin = rows.some(
    (member) => member.id !== memberId && isAdminLikeOrganizationRole(member.role),
  )

  if (!hasAnotherAdmin) {
    throw new APIError("BAD_REQUEST", {
      message: "Each organization account must have at least one admin.",
    })
  }
}

async function deleteWebUserForAuthUser(authUserId: string) {
  await db.delete(users).where(eq(users.id, authUserId))
}

export const auth = betterAuth({
  database: authDatabase,
  trustedOrigins,
  socialProviders: {
    microsoft: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      tenantId: "common",
      authority: "https://login.microsoftonline.com",
      prompt: "select_account",
    },
  },
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
        admin: adminAc,
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
        beforeRemoveMember: async ({ member }) => {
          await assertOrganizationWillKeepAdmin({
            organizationId: member.organizationId,
            memberId: member.id,
            currentRole: member.role,
          })
        },
        beforeUpdateMemberRole: async ({ member, newRole }) => {
          await assertOrganizationWillKeepAdmin({
            organizationId: member.organizationId,
            memberId: member.id,
            currentRole: member.role,
            nextRole: newRole,
          })
        },
        afterAcceptInvitation: async ({ member, user }) => {
          await syncWebUserForOrganizationMember({
            authUser: user as BetterAuthUserRecord,
            organizationId: member.organizationId,
            role: member.role,
          })
        },
        afterRemoveMember: async ({ user }) => {
          await db
            .update(users)
            .set({
              organizationId: null,
              role: "individual",
              stripeCustomerId: null,
              stripePaymentMethodId: null,
              billingStartedAt: null,
              nextPaymentAt: null,
              lastPaymentAt: null,
              billingStatus: "stripe_info_missing",
              billingFailureCount: 0,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id))
        },
        afterUpdateMemberRole: async ({ member, user }) => {
          await syncWebUserForOrganizationMember({
            authUser: user as BetterAuthUserRecord,
            organizationId: member.organizationId,
            role: member.role,
          })
        },
        afterCreateOrganization: async ({ organization }) => {
          const createdAt = new Date(organization.createdAt)
          await db.insert(organizations).values({
            id: organization.id,
            billingStartedAt: createdAt,
            nextPaymentAt: addOneMonth(createdAt),
            billingStatus: "stripe_info_missing",
            createdAt,
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
