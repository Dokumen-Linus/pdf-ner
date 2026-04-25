import { describe, expect, it } from "bun:test"
import { eq, sql } from "drizzle-orm"

import { setAuthenticated } from "~/tests/bun-test-setup/mocks"
import { db } from "@/db/client"
import { pdfs } from "@/db/schemas/web/pdfs"
import { projects } from "@/db/schemas/web/projects"
import { users } from "@/db/schemas/web/users"
import { workersPdfs } from "@/db/schemas/workers/pdfs"

import {
  createAnnotation,
  deleteAnnotation,
  getAnnotationById,
  getAnnotationsByPdfId,
  getAnnotationsBySubtype,
  LabellingLockLostError,
  saveAnnotationsByPdfId,
  updateAnnotation,
} from "./annotations"
import { acquireLabellingLock, releaseLabellingLock } from "./pdfs"

const runTests = process.env.TEST_DB === "true"

type AnnotationRecord = {
  id: string
  pdfId: string
  subtype: string
  pageIndex: number
  color: string | null
  opacity: number | null
  contents: string | null
}

describe.if(runTests)("Annotation Table Server Functions", () => {
  const testPdfId = "00000000-0000-0000-0000-000000000001"
  const testSubtype = "highlight"
  const testRect = { x: 0, y: 0, width: 100, height: 50 }
  const testSegmentRects = [{ x: 0, y: 0, width: 50, height: 25 }]

  it("should handle the full annotation lifecycle (CRUD)", async () => {
    // --- CREATE ---
    const createInput = {
      id: crypto.randomUUID(),
      pdfId: testPdfId,
      subtype: testSubtype,
      rect: testRect,
      segmentRects: testSegmentRects,
      pageIndex: 0,
      color: "#ffff00",
      opacity: 0.5,
      contents: "Test annotation",
      author: "Test Author",
    }
    const createOutput = await createAnnotation({ data: createInput })
    expect(createOutput.id).toBeUuid()

    // --- READ (by pdfId and subtype to get the created annotation) ---
    const annotationsForLookup = (await getAnnotationsByPdfId({
      data: { pdfId: testPdfId },
    })) as AnnotationRecord[]
    expect(annotationsForLookup).toBeDefined()
    expect(annotationsForLookup.length).toBeGreaterThan(0)

    const createdAnnotation = annotationsForLookup.find(
      (ann) => ann.subtype === testSubtype && ann.contents === "Test annotation",
    )
    expect(createdAnnotation).toBeDefined()
    expect(createdAnnotation!.pdfId).toBe(testPdfId)
    expect(createdAnnotation!.subtype).toBe(testSubtype)
    const annotationId = createdAnnotation!.id

    // --- READ (by id) ---
    const annotationById = (await getAnnotationById({
      data: { id: annotationId },
    })) as AnnotationRecord
    expect(annotationById).toBeDefined()
    expect(annotationById.pdfId).toBe(testPdfId)
    expect(annotationById.subtype).toBe(testSubtype)

    // --- READ (by pdfId) ---
    const annotationsByPdfId = (await getAnnotationsByPdfId({
      data: { pdfId: testPdfId },
    })) as AnnotationRecord[]
    expect(annotationsByPdfId).toBeDefined()
    expect(annotationsByPdfId.length).toBeGreaterThan(0)
    expect(annotationsByPdfId[0].pdfId).toBe(testPdfId)

    // --- READ (by subtype) ---
    const annotationsBySubtype = (await getAnnotationsBySubtype({
      data: { subtype: testSubtype },
    })) as AnnotationRecord[]
    expect(annotationsBySubtype).toBeDefined()
    expect(annotationsBySubtype.length).toBeGreaterThan(0)
    expect(annotationsBySubtype[0].subtype).toBe(testSubtype)

    // --- UPDATE ---
    const updateInput = {
      id: annotationId,
      color: "#ff0000",
      opacity: 0.8,
      contents: "Updated annotation",
    }
    const updateOutput = await updateAnnotation({ data: updateInput })
    expect(updateOutput.success).toBe(true)

    const updatedAnnotation = (await getAnnotationById({
      data: { id: annotationId },
    })) as AnnotationRecord
    expect(updatedAnnotation.color).toBe("#ff0000")
    expect(updatedAnnotation.opacity).toBe(0.8)
    expect(updatedAnnotation.contents).toBe("Updated annotation")

    // --- DELETE ---
    const deleteOutput = await deleteAnnotation({ data: { id: annotationId } })
    expect(deleteOutput.success).toBe(true)

    // Verify deletion
    await expect(getAnnotationById({ data: { id: annotationId } })).rejects.toThrow(
      "Annotation not found",
    )
  })

  describe("Validation and Error Handling", () => {
    it("throws error for invalid subtype in createAnnotation", async () => {
      const input = {
        id: "0",
        pdfId: testPdfId,
        subtype: "", // empty subtype should fail
        rect: testRect,
        segmentRects: testSegmentRects,
        pageIndex: 0,
      }
      await expect(createAnnotation({ data: input })).rejects.toThrow()
    })

    it("throws error for negative page index", async () => {
      const input = {
        id: "0",
        pdfId: testPdfId,
        subtype: testSubtype,
        rect: testRect,
        segmentRects: testSegmentRects,
        pageIndex: -1, // negative page index should fail
      }
      await expect(createAnnotation({ data: input })).rejects.toThrow()
    })

    it("throws 'Annotation not found' for non-existent ID", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(getAnnotationById({ data: { id: fakeId } })).rejects.toThrow(
        "Annotation not found",
      )
    })

    it("throws 'Annotation not found' when updating non-existent annotation", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(updateAnnotation({ data: { id: fakeId, color: "#ff0000" } })).rejects.toThrow(
        "Annotation not found",
      )
    })

    it("throws 'Annotation not found' when deleting non-existent annotation", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(deleteAnnotation({ data: { id: fakeId } })).rejects.toThrow(
        "Annotation not found",
      )
    })
  })
})

// Save path tests — exercise the lock-checked transactional replace logic.
// These tests need real fixtures (a workers.pdfs row and two web.users rows)
// and do NOT share the hard-coded testPdfId above, because that id is expected
// NOT to exist in the foreign-key parent table.
async function loadSaveFixtures() {
  const [ownedPdf] = await db
    .select({ pdfId: workersPdfs.id, ownerId: projects.ownerId })
    .from(workersPdfs)
    .innerJoin(projects, eq(projects.id, workersPdfs.projectId))
    .limit(1)
  if (!ownedPdf) return null

  const [otherUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.id} <> ${ownedPdf.ownerId}`)
    .limit(1)
  if (!otherUser) return null

  return {
    pdfId: ownedPdf.pdfId,
    userAId: ownedPdf.ownerId,
    userBId: otherUser.id,
  }
}

describe.if(runTests)("saveAnnotationsByPdfId", () => {
  const testRect = { x: 0, y: 0, width: 100, height: 50 }
  const testSegmentRects = [{ x: 0, y: 0, width: 50, height: 25 }]

  it("full-replaces annotations when the lock is held by the caller", async () => {
    const f = await loadSaveFixtures()
    if (!f) {
      console.warn("[annotations.test] skipping save tests — missing fixtures")
      return
    }
    // Start clean.
    await db
      .update(pdfs)
      .set({ lockedBy: null, lockedAt: null })
      .where(sql`${pdfs.id} = ${f.pdfId}`)

    try {
      setAuthenticated({ id: f.userAId! })
      await acquireLabellingLock({ data: { pdfId: f.pdfId, userId: f.userAId! } })

      const initial = [
        {
          id: crypto.randomUUID(),
          pdfId: f.pdfId,
          subtype: "highlight",
          rect: testRect,
          segmentRects: testSegmentRects,
          pageIndex: 0,
          color: "#00ff00",
          opacity: 0.5,
          contents: "one",
          customEntityType: "Title",
        },
        {
          id: crypto.randomUUID(),
          pdfId: f.pdfId,
          subtype: "underline",
          rect: testRect,
          segmentRects: testSegmentRects,
          pageIndex: 1,
          color: "#0000ff",
          opacity: 0.4,
          contents: "two",
          customEntityType: "Date",
        },
      ]
      const first = await saveAnnotationsByPdfId({
        data: {
          pdfId: f.pdfId,
          userId: f.userAId!,
          annotations: initial,
          labeledEntities: { Title: ["one"], Date: ["two"] },
        },
      })
      expect(first.success).toBe(true)
      expect(first.count).toBe(2)

      const afterFirst = (await getAnnotationsByPdfId({
        data: { pdfId: f.pdfId },
      })) as AnnotationRecord[]
      expect(afterFirst.length).toBe(2)
      const contentSet = new Set(afterFirst.map((a) => a.contents))
      expect(contentSet.has("one")).toBe(true)
      expect(contentSet.has("two")).toBe(true)

      // Second save replaces the prior set completely — "one"/"two" are gone.
      const replacement = [
        {
          id: crypto.randomUUID(),
          pdfId: f.pdfId,
          subtype: "highlight",
          rect: testRect,
          segmentRects: testSegmentRects,
          pageIndex: 0,
          color: "#ff0000",
          opacity: 0.7,
          contents: "three",
          customEntityType: "Agency",
        },
      ]
      await saveAnnotationsByPdfId({
        data: {
          pdfId: f.pdfId,
          userId: f.userAId!,
          annotations: replacement,
          labeledEntities: { Agency: ["three"] },
        },
      })

      const afterSecond = (await getAnnotationsByPdfId({
        data: { pdfId: f.pdfId },
      })) as AnnotationRecord[]
      expect(afterSecond.length).toBe(1)
      expect(afterSecond[0].contents).toBe("three")

      // Empty save is also valid — clears everything.
      await saveAnnotationsByPdfId({
        data: {
          pdfId: f.pdfId,
          userId: f.userAId!,
          annotations: [],
          labeledEntities: {},
        },
      })
      const afterEmpty = (await getAnnotationsByPdfId({
        data: { pdfId: f.pdfId },
      })) as AnnotationRecord[]
      expect(afterEmpty.length).toBe(0)
    } finally {
      // Clean up: release lock, wipe any stray test annotations.
      await db
        .update(pdfs)
        .set({ lockedBy: null, lockedAt: null })
        .where(sql`${pdfs.id} = ${f.pdfId}`)
    }
  })

  it("rejects save when the caller does not hold the lock", async () => {
    const f = await loadSaveFixtures()
    if (!f) {
      console.warn("[annotations.test] skipping no-lock test — missing fixtures")
      return
    }
    await db
      .update(pdfs)
      .set({ lockedBy: null, lockedAt: null })
      .where(sql`${pdfs.id} = ${f.pdfId}`)

    try {
      // userA holds the lock.
      setAuthenticated({ id: f.userAId! })
      await acquireLabellingLock({ data: { pdfId: f.pdfId, userId: f.userAId! } })

      // userB tries to save a project they do not own — reject before lock logic.
      setAuthenticated({ id: f.userBId! })
      await expect(
        saveAnnotationsByPdfId({
          data: {
            pdfId: f.pdfId,
            userId: f.userBId!,
            annotations: [],
            labeledEntities: {},
          },
        }),
      ).rejects.toThrow("You do not have access to this project")
    } finally {
      setAuthenticated({ id: f.userAId! })
      await releaseLabellingLock({ data: { pdfId: f.pdfId, userId: f.userAId! } })
    }
  })

  it("rejects save when the lock has gone stale", async () => {
    const f = await loadSaveFixtures()
    if (!f) {
      console.warn("[annotations.test] skipping stale-save test — missing fixtures")
      return
    }
    // Seed a stale lock on userA (locked_at 10 min ago).
    await db
      .update(pdfs)
      .set({ lockedBy: f.userAId, lockedAt: sql`now() - interval '10 minutes'` })
      .where(sql`${pdfs.id} = ${f.pdfId}`)

    try {
      // Even userA can't save — their own heartbeat is stale, meaning the lock
      // is logically forfeited. The app should treat it as "session expired".
      setAuthenticated({ id: f.userAId! })
      await expect(
        saveAnnotationsByPdfId({
          data: {
            pdfId: f.pdfId,
            userId: f.userAId!,
            annotations: [],
            labeledEntities: {},
          },
        }),
      ).rejects.toThrow(LabellingLockLostError)

      await expect(
        saveAnnotationsByPdfId({
          data: {
            pdfId: f.pdfId,
            userId: f.userBId!,
            annotations: [],
            labeledEntities: {},
          },
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
