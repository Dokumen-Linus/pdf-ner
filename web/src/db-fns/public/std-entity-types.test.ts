import { describe, expect, it } from "bun:test"
import {
  getAllStdEntityTypes,
  getStdEntityTypeById,
  getStdEntityTypeByShortName,
  getStdEntityTypesByDatatype,
} from "./std-entity-types"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Public Standard Entity Types Read-Only Functions", () => {
  describe("getAllStdEntityTypes", () => {
    it("returns an array of standard entity types", async () => {
      const result = await getAllStdEntityTypes({ data: {} })
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe("getStdEntityTypeById", () => {
    it("returns a standard entity type when it exists", async () => {
      const allTypes = await getAllStdEntityTypes({ data: {} })
      if (allTypes.length > 0) {
        const firstType = allTypes[0]
        const result = await getStdEntityTypeById({ data: { id: firstType.id } })
        expect(result).toBeDefined()
        expect(result.id).toBe(firstType.id)
        expect(result.shortName).toBe(firstType.shortName)
      }
    })

    it("throws 'Standard entity type not found' for non-existent ID", async () => {
      const fakeId = 999999
      await expect(getStdEntityTypeById({ data: { id: fakeId } })).rejects.toThrow(
        "Standard entity type not found",
      )
    })
  })

  describe("getStdEntityTypeByShortName", () => {
    it("returns a standard entity type when it exists", async () => {
      const allTypes = await getAllStdEntityTypes({ data: {} })
      if (allTypes.length > 0) {
        const firstType = allTypes[0]
        const result = await getStdEntityTypeByShortName({
          data: { shortName: firstType.shortName },
        })
        expect(result).toBeDefined()
        expect(result.shortName).toBe(firstType.shortName)
      }
    })

    it("throws 'Standard entity type not found' for non-existent short name", async () => {
      await expect(
        getStdEntityTypeByShortName({ data: { shortName: "non_existent_type_xyz" } }),
      ).rejects.toThrow("Standard entity type not found")
    })
  })

  describe("getStdEntityTypesByDatatype", () => {
    it("returns an array of standard entity types for a datatype", async () => {
      const result = await getStdEntityTypesByDatatype({ data: { datatype: "int" } })
      expect(Array.isArray(result)).toBe(true)
    })

    it("returns an empty array for non-existent datatype", async () => {
      const result = await getStdEntityTypesByDatatype({
        data: { datatype: "non_existent_datatype" },
      })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })
})
