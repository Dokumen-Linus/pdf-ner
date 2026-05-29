import { describe, expect, it } from "bun:test"
import { z } from "zod"

import { CreateAnnotationSchema, UpdateAnnotationSchema } from "./annotations"
import { CreateApplicationSchema } from "./applications"
import { CreateEntityTypeSchema, UpdateEntityTypeSchema } from "./entity-types"
import { CreatePdfSchema, UpdatePdfSchema } from "./pdfs"
import { CreateProjectSchema, UpdateProjectSchema } from "./projects"
import { CreateUserSchema, UpdateUserSchema } from "./users"

import type {
  DbAnnotationUpdate,
  DbEntityTypeUpdate,
  DbWebPdfUpdate,
  NewApplication,
  NewDbAnnotation,
  NewDbEntityType,
  NewDbWebPdf,
  NewProject,
  NewUser,
  ProjectUpdate,
  UserUpdate,
} from "../../db/types"

/**
 * These tests serve as a compile-time check to ensure that the Zod schemas
 * used for validation match the Drizzle types generated from the database schema.
 *
 * If these tests fail to compile, it means there is a mismatch between the
 * validation logic and the database structure.
 */
describe("Schema vs DB Type Matching", () => {
  it("CreateUserSchema should match NewUser", () => {
    type ZodType = z.infer<typeof CreateUserSchema>
    type DbType = NewUser

    // Zod output should be assignable to DB input
    // Using simple CAst to check assignability
    const _zodToDb: DbType = {} as ZodType

    // DB input should be assignable to Zod input (optional)
    // Note: This might fail if DB allows nulls and Zod doesn't (optional vs nullable)
    // const _dbToZod: ZodType = {} as DbType

    expect(true).toBe(true)
  })

  it("UpdateUserSchema payload should match UserUpdate", () => {
    type ZodType = z.infer<typeof UpdateUserSchema>
    // UpdateUserSchema includes `id`, but UserUpdate (utils type) excludes it
    type ZodPayload = Omit<ZodType, "id">
    type DbPayload = UserUpdate

    const _zodToDb: DbPayload = {} as ZodPayload

    expect(true).toBe(true)
  })

  it("CreateProjectSchema should match NewProject", () => {
    type ZodType = z.infer<typeof CreateProjectSchema>
    type DbType = NewProject

    const _zodToDb: DbType = {} as ZodType

    expect(true).toBe(true)
  })

  it("UpdateProjectSchema payload should match ProjectUpdate", () => {
    type ZodType = z.infer<typeof UpdateProjectSchema>
    type ZodPayload = Omit<ZodType, "id">
    type DbPayload = ProjectUpdate

    const _zodToDb: DbPayload = {} as ZodPayload

    expect(true).toBe(true)
  })

  // ** ENTITY TYPES **
  it("CreateEntityTypeSchema should match NewDbEntityType", () => {
    type ZodType = z.infer<typeof CreateEntityTypeSchema>
    type DbType = NewDbEntityType

    // Zod output should be assignable to DB input
    const _zodToDb: DbType = {} as ZodType

    expect(true).toBe(true)
  })

  it("UpdateEntityTypeSchema payload should match DbEntityTypeUpdate", () => {
    type ZodType = z.infer<typeof UpdateEntityTypeSchema>
    // UpdateEntityTypeSchema includes `id`, but DbEntityTypeUpdate excludes it
    type ZodPayload = Omit<ZodType, "id">
    type DbPayload = DbEntityTypeUpdate

    const _zodToDb: DbPayload = {} as ZodPayload

    expect(true).toBe(true)
  })

  // ** PDFS **
  it("CreatePdfSchema should match NewDbWebPdf", () => {
    type ZodType = z.infer<typeof CreatePdfSchema>
    type DbType = NewDbWebPdf

    // Zod output should be assignable to DB input
    const _zodToDb: DbType = {} as ZodType

    expect(true).toBe(true)
  })

  it("UpdatePdfSchema payload should match DbWebPdfUpdate", () => {
    type ZodType = z.infer<typeof UpdatePdfSchema>
    // UpdatePdfSchema includes `id`, but DbWebPdfUpdate excludes it
    type ZodPayload = Omit<ZodType, "id">
    type DbPayload = DbWebPdfUpdate

    const _zodToDb: DbPayload = {} as ZodPayload

    expect(true).toBe(true)
  })

  // ** ANNOTATIONS **
  it("CreateAnnotationSchema should match NewDbAnnotation", () => {
    type ZodType = z.infer<typeof CreateAnnotationSchema>
    type DbType = NewDbAnnotation

    // Zod output should be assignable to DB input
    const _zodToDb: DbType = {} as ZodType

    expect(true).toBe(true)
  })

  it("UpdateAnnotationSchema payload should match DbAnnotationUpdate", () => {
    type ZodType = z.infer<typeof UpdateAnnotationSchema>
    // UpdateAnnotationSchema includes `id`, but DbAnnotationUpdate excludes it
    type ZodPayload = Omit<ZodType, "id">
    type DbPayload = DbAnnotationUpdate

    const _zodToDb: DbPayload = {} as ZodPayload

    expect(true).toBe(true)
  })

  // ** APPLICATIONS **
  it("CreateApplicationSchema should match NewApplication", () => {
    type ZodType = z.infer<typeof CreateApplicationSchema>
    type DbType = NewApplication

    // Zod output should be assignable to DB input
    const _zodToDb: DbType = {} as ZodType

    expect(true).toBe(true)
  })
})
