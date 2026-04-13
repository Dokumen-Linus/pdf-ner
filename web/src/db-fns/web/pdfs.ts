import { createServerFn } from "@tanstack/react-start"
import { and, eq, isNull, or, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db/client"
import { pdfs } from "@/db/schemas/web/pdfs"
import { users } from "@/db/schemas/web/users"
import { requirePdfOwnership, requireUserId } from "../api/_helpers"

// Stale threshold in seconds. Clients must heartbeat faster than this.
// 120s window / 30s heartbeat = 4 missed heartbeats before steal.
const STALE_SECONDS = 120

// Must match LabeledEntitiesMap in @/db/schemas/web/pdfs — Zod is the wire
// schema, the Drizzle $type is the storage schema. Schema-match test keeps
// them aligned.
export const LabeledEntitiesSchema = z.record(z.string(), z.array(z.string()))

// ** CREATE **
export const CreatePdfSchema = z.object({
  id: z.string(),
  labeledEntities: LabeledEntitiesSchema.nullable().optional(),
  annotated: z.boolean().optional(),
  uploadedBy: z.string().nullable().optional(),
  firstViewedAt: z.date().nullable().optional(),
  lockedBy: z.string().nullable().optional(),
  lockedAt: z.date().nullable().optional(),
})

export const createPdf = createServerFn({ method: "POST" })
  .inputValidator(CreatePdfSchema)
  .handler(async ({ data }) => {
    const [pdf] = await db.insert(pdfs).values(data).returning({ id: pdfs.id })
    return { id: pdf.id }
  })

// ** READ **
export const getPdfById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const pdf = await db.select().from(pdfs).where(eq(pdfs.id, data.id))
    if (pdf.length === 0) {
      throw new Error("PDF not found")
    }
    return pdf[0]
  })

// ** UPDATE **
// partial create schema with id required
export const UpdatePdfSchema = CreatePdfSchema.partial().extend({
  id: z.string(),
})

export const updatePdf = createServerFn({ method: "POST" })
  .inputValidator(UpdatePdfSchema)
  .handler(async ({ data }) => {
    const { id, ...updateData } = data
    const updatedPdf = await db.update(pdfs).set(updateData).where(eq(pdfs.id, id))
    if (updatedPdf.rowCount === 0) {
      throw new Error("PDF not found")
    }
    return { success: true }
  })

// ** DELETE **
export const deletePdf = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const pdf = await db.delete(pdfs).where(eq(pdfs.id, data.id))
    if (pdf.rowCount === 0) {
      throw new Error("PDF not found")
    }
    return { success: true }
  })

// ** LABELS **
// Upsert labels on web.pdfs. The row is created during PDF upload (see
// api/app/domains/pdf_storage/repository.py::insert_pdf), so the INSERT branch
// is a belt-and-braces safety net for reupload/migration scenarios.
export const UpsertPdfLabelsSchema = z.object({
  id: z.string(),
  labeledEntities: LabeledEntitiesSchema,
  uploadedBy: z.string().optional(),
})

export const upsertPdfLabels = createServerFn({ method: "POST" })
  .inputValidator(UpsertPdfLabelsSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    if (data.uploadedBy && data.uploadedBy !== userId) {
      throw new Error("Cannot act as another user")
    }
    await requirePdfOwnership(data.id, userId)

    await db
      .insert(pdfs)
      .values({
        id: data.id,
        labeledEntities: data.labeledEntities,
        uploadedBy: userId,
      })
      .onConflictDoUpdate({
        target: pdfs.id,
        set: {
          labeledEntities: data.labeledEntities,
          uploadedBy: userId,
        },
      })
    return { success: true }
  })

// ** LOCK TRIAD **
// Acquire or refresh the editing lock for a given pdf for a given user.
// SQL contract: the UPDATE only succeeds if the row is currently unlocked,
// already held by this same user, or held by a user whose heartbeat has
// lapsed beyond STALE_SECONDS.
export const AcquireLockSchema = z.object({
  pdfId: z.string(),
  userId: z.string().optional(),
})

async function requireAuthorizedPdfUser(pdfId: string, claimedUserId?: string): Promise<string> {
  const userId = await requireUserId()
  if (claimedUserId && claimedUserId !== userId) {
    throw new Error("Cannot act as another user")
  }
  await requirePdfOwnership(pdfId, userId)
  return userId
}

export const acquireLabellingLock = createServerFn({ method: "POST" })
  .inputValidator(AcquireLockSchema)
  .handler(async ({ data }) => {
    const userId = await requireAuthorizedPdfUser(data.pdfId, data.userId)

    const acquired = await db
      .update(pdfs)
      .set({ lockedBy: userId, lockedAt: sql`now()` })
      .where(
        and(
          eq(pdfs.id, data.pdfId),
          or(
            isNull(pdfs.lockedBy),
            eq(pdfs.lockedBy, userId),
            sql`${pdfs.lockedAt} < now() - make_interval(secs => ${STALE_SECONDS})`,
          ),
        ),
      )
      .returning({ lockedBy: pdfs.lockedBy, lockedAt: pdfs.lockedAt })

    if (acquired.length > 0) {
      return {
        acquired: true as const,
        lockedAt: acquired[0].lockedAt,
      }
    }

    // Lock held by someone else. Fetch holder info so the UI can tell the user
    // who's editing. JOIN through web.users for a display name.
    const [holder] = await db
      .select({
        lockedBy: pdfs.lockedBy,
        lockedAt: pdfs.lockedAt,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: users.displayName,
        email: users.email,
      })
      .from(pdfs)
      .leftJoin(users, eq(users.id, pdfs.lockedBy))
      .where(eq(pdfs.id, data.pdfId))
      .limit(1)

    if (!holder) {
      throw new Error("PDF not found")
    }

    const holderName =
      holder.displayName ||
      [holder.firstName, holder.lastName].filter(Boolean).join(" ") ||
      holder.email ||
      "another user"

    return {
      acquired: false as const,
      lockedBy: holder.lockedBy,
      lockedByName: holderName,
      lockedAt: holder.lockedAt,
    }
  })

// Refresh the lock's timestamp IFF still held by the same user.
// Client should call every ~30s while the labelling page is open.
export const HeartbeatLockSchema = z.object({
  pdfId: z.string(),
  userId: z.string().optional(),
})

export const heartbeatLabellingLock = createServerFn({ method: "POST" })
  .inputValidator(HeartbeatLockSchema)
  .handler(async ({ data }) => {
    const userId = await requireAuthorizedPdfUser(data.pdfId, data.userId)

    const refreshed = await db
      .update(pdfs)
      .set({ lockedAt: sql`now()` })
      .where(and(eq(pdfs.id, data.pdfId), eq(pdfs.lockedBy, userId)))
      .returning({ id: pdfs.id })
    return { stillHeld: refreshed.length > 0 }
  })

// Release the lock IFF held by this user. Best-effort.
export const ReleaseLockSchema = z.object({
  pdfId: z.string(),
  userId: z.string().optional(),
})

export const releaseLabellingLock = createServerFn({ method: "POST" })
  .inputValidator(ReleaseLockSchema)
  .handler(async ({ data }) => {
    const userId = await requireAuthorizedPdfUser(data.pdfId, data.userId)

    const released = await db
      .update(pdfs)
      .set({ lockedBy: null, lockedAt: null })
      .where(and(eq(pdfs.id, data.pdfId), eq(pdfs.lockedBy, userId)))
      .returning({ id: pdfs.id })
    return { released: released.length > 0 }
  })

// Exported for save-path verification — keep single source of truth.
export const LABELLING_LOCK_STALE_SECONDS = STALE_SECONDS
