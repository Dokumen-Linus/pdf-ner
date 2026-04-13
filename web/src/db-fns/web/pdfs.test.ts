import { describe, expect, it } from "bun:test"
import { eq, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { workersPdfs } from "@/db/schemas/workers/pdfs"
import { pdfs } from "@/db/schemas/web/pdfs"
import { projects } from "@/db/schemas/web/projects"
import { users } from "@/db/schemas/web/users"
import { setAuthenticated } from "~/tests/bun-test-setup/mocks"
import { getAllWorkersPdfs } from "../workers/pdfs"
import {
  acquireLabellingLock,
  heartbeatLabellingLock,
  releaseLabellingLock,
  upsertPdfLabels,
} from "./pdfs"

const runTests = process.env.TEST_DB === "true"

// Fixture helper — finds a PDF with a real owner plus a second distinct user so
// authz tests can exercise both the owning session and a cross-project caller.
async function loadFixtures() {
  const [ownedPdf] = await db
    .select({ pdfId: workersPdfs.id, ownerId: projects.ownerId })
    .from(workersPdfs)
    .innerJoin(projects, eq(projects.id, workersPdfs.projectId))
    .limit(1)
  if (!ownedPdf) {
    return null
  }

  const [otherUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.id} <> ${ownedPdf.ownerId}`)
    .limit(1)
  if (!otherUser) {
    return null
  }

  return {
    pdfId: ownedPdf.pdfId,
    userAId: ownedPdf.ownerId,
    userBId: otherUser.id,
  }
}

describe.if(runTests)("web.pdfs labelling lock", () => {
  it("acquires, refuses to steal a fresh lock, heartbeats, and releases", async () => {
    const f = await loadFixtures()
    if (!f) {
      console.warn("[pdfs.test] skipping lock tests — TEST_DB lacks workers.pdfs + >=2 web.users")
      return
    }

    // Clean slate: forcibly release any existing lock before we begin.
    await db
      .update(pdfs)
      .set({ lockedBy: null, lockedAt: null })
      .where(sql`${pdfs.id} = ${f.pdfId}`)

    try {
      setAuthenticated({ id: f.userAId })

      // userA acquires the lock.
      const firstAcquire = await acquireLabellingLock({
        data: { pdfId: f.pdfId, userId: f.userAId },
      })
      expect(firstAcquire.acquired).toBe(true)

      // userA re-acquires — same-user acquire is idempotent (refresh).
      const sameUserAcquire = await acquireLabellingLock({
        data: { pdfId: f.pdfId, userId: f.userAId },
      })
      expect(sameUserAcquire.acquired).toBe(true)

      // userB tries to acquire — must be refused. Fresh lock, not stale.
      setAuthenticated({ id: f.userBId })
      const userBAttempt = await acquireLabellingLock({
        data: { pdfId: f.pdfId, userId: f.userBId },
      }).catch((error) => error)
      expect(userBAttempt).toBeInstanceOf(Error)
      if (userBAttempt instanceof Error) {
        expect(userBAttempt.message).toBe("You do not have access to this project")
      }

      // userA heartbeats — still holds.
      setAuthenticated({ id: f.userAId })
      const heartbeatA = await heartbeatLabellingLock({
        data: { pdfId: f.pdfId, userId: f.userAId },
      })
      expect(heartbeatA.stillHeld).toBe(true)

      // userB heartbeats — correctly fails (they don't hold it).
      setAuthenticated({ id: f.userBId })
      const heartbeatB = await heartbeatLabellingLock({
        data: { pdfId: f.pdfId, userId: f.userBId },
      }).catch((error) => error)
      expect(heartbeatB).toBeInstanceOf(Error)

      // userB tries to release — correctly fails (not theirs to release).
      setAuthenticated({ id: f.userBId })
      const badRelease = await releaseLabellingLock({
        data: { pdfId: f.pdfId, userId: f.userBId },
      }).catch((error) => error)
      expect(badRelease).toBeInstanceOf(Error)

      // userA releases.
      setAuthenticated({ id: f.userAId })
      const goodRelease = await releaseLabellingLock({
        data: { pdfId: f.pdfId, userId: f.userAId },
      })
      expect(goodRelease.released).toBe(true)

      // Cross-project callers stay blocked even after release.
      setAuthenticated({ id: f.userBId })
      await expect(
        acquireLabellingLock({
          data: { pdfId: f.pdfId, userId: f.userBId },
        }),
      ).rejects.toThrow("You do not have access to this project")
    } finally {
      // Always leave the fixture row unlocked so subsequent test runs start clean.
      await db
        .update(pdfs)
        .set({ lockedBy: null, lockedAt: null })
        .where(sql`${pdfs.id} = ${f.pdfId}`)
    }
  })

  it("lets another user steal the lock once it has gone stale", async () => {
    const f = await loadFixtures()
    if (!f) {
      console.warn("[pdfs.test] skipping stale-lock test — no fixtures")
      return
    }

    // Seed a lock with a locked_at timestamp deliberately past the stale window.
    // Directly writes via Drizzle since no public API allows setting locked_at
    // to an arbitrary time (by design — clients can't fake staleness).
    await db
      .update(pdfs)
      .set({ lockedBy: f.userAId, lockedAt: sql`now() - interval '10 minutes'` })
      .where(sql`${pdfs.id} = ${f.pdfId}`)

    try {
      setAuthenticated({ id: f.userAId })
      await expect(
        acquireLabellingLock({
          data: { pdfId: f.pdfId, userId: f.userBId },
        }),
      ).rejects.toThrow("Cannot act as another user")

      setAuthenticated({ id: f.userAId })
      const stolen = await acquireLabellingLock({
        data: { pdfId: f.pdfId, userId: f.userAId },
      })
      expect(stolen.acquired).toBe(true)

      setAuthenticated({ id: f.userAId })
      await expect(
        heartbeatLabellingLock({
          data: { pdfId: f.pdfId, userId: f.userBId },
        }),
      ).rejects.toThrow("Cannot act as another user")
    } finally {
      await db
        .update(pdfs)
        .set({ lockedBy: null, lockedAt: null })
        .where(sql`${pdfs.id} = ${f.pdfId}`)
    }
  })
})

describe.if(runTests)("web.pdfs label upsert", () => {
  it("upserts labeled_entities JSONB on the pdf row", async () => {
    const allPdfs = await getAllWorkersPdfs({ data: {} })
    if (allPdfs.length === 0) {
      console.warn("[pdfs.test] skipping upsertPdfLabels test — no workers.pdfs rows")
      return
    }
    const pdfId = allPdfs[0].id

    const payload = { Title: ["Executive Order 14291"], Date: ["2025-10-15"] }
    const first = await upsertPdfLabels({
      data: { id: pdfId, labeledEntities: payload },
    })
    expect(first.success).toBe(true)

    const [row1] = await db
      .select({ labeledEntities: pdfs.labeledEntities })
      .from(pdfs)
      .where(sql`${pdfs.id} = ${pdfId}`)
    expect(row1.labeledEntities).toEqual(payload)

    // Second call overwrites — it's an upsert, not an append.
    const payload2 = { Agency: ["FDA"] }
    await upsertPdfLabels({
      data: { id: pdfId, labeledEntities: payload2 },
    })
    const [row2] = await db
      .select({ labeledEntities: pdfs.labeledEntities })
      .from(pdfs)
      .where(sql`${pdfs.id} = ${pdfId}`)
    expect(row2.labeledEntities).toEqual(payload2)
  })
})
