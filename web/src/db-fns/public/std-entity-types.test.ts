import { describe, expect, it } from "bun:test"

import {
  getAllStdEntityTypes,
  getStdEntityTypeById,
  getStdEntityTypeByShortName,
  getStdEntityTypesByCategory,
  getStdEntityTypesByDatatype,
} from "./std-entity-types"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("public.std_entity_types", () => {
  it("getStdEntityTypeById returns an entity type", async () => {
    const all = await getAllStdEntityTypes()
    if (all.length === 0) {
      console.warn("[std-entity-types.test] skipping — no std entity types in DB")
      return
    }
    const et = await getStdEntityTypeById({ data: { id: all[0].id } })
    expect(et.id).toBe(all[0].id)
  })

  it("getStdEntityTypeByShortName returns an entity type", async () => {
    const all = await getAllStdEntityTypes()
    if (all.length === 0) {
      console.warn("[std-entity-types.test] skipping — no std entity types in DB")
      return
    }
    const et = await getStdEntityTypeByShortName({ data: { shortName: all[0].shortName } })
    expect(et.shortName).toBe(all[0].shortName)
  })

  it("getAllStdEntityTypes returns an array", async () => {
    const result = await getAllStdEntityTypes()
    expect(Array.isArray(result)).toBe(true)
  })

  it("getStdEntityTypesByDatatype returns filtered results", async () => {
    const all = await getAllStdEntityTypes()
    const withDatatype = all.find((et) => et.datatype != null)
    if (!withDatatype) {
      console.warn("[std-entity-types.test] skipping datatype filter — no entity types with datatype")
      return
    }
    const result = await getStdEntityTypesByDatatype({ data: { datatype: withDatatype.datatype! } })
    expect(result.length).toBeGreaterThan(0)
  })

  it("getStdEntityTypesByCategory returns filtered results", async () => {
    const all = await getAllStdEntityTypes()
    if (all.length === 0) {
      console.warn("[std-entity-types.test] skipping category filter — no entity types")
      return
    }
    const result = await getStdEntityTypesByCategory({ data: { category: all[0].category } })
    expect(result.length).toBeGreaterThan(0)
  })

  it("getStdEntityTypeById throws for non-existent ID", async () => {
    await expect(
      getStdEntityTypeById({ data: { id: 999999 } }),
    ).rejects.toThrow("Standard entity type not found")
  })
})
