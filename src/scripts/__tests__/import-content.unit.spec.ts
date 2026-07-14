import {
  planContentImport,
  parseArgs,
  ContentFileInput,
  ProductInput,
} from "../import-content"
import { planContentExport } from "../export-content"
import { serializeContentFile } from "../../utils/content-files"

const validCompound = {
  type: "compound",
  overview: { what: "An oral anabolic.", howItWorks: "Binds AR." },
  dosage: {
    beginner: "20-30 mg/day",
    intermediate: "40-60 mg/day",
    advanced: "80 mg/day",
    cycleLength: "6-8 weeks",
    administration: "Oral",
    pct: "Nolvadex 20mg",
  },
  profile: {
    anabolicRating: "322",
    androgenicRating: "24",
    ester: "None",
    halfLife: "9 hours",
    aromatization: "No",
    detectionTime: "3 weeks",
  },
  sideEffects: {
    estrogenic: "None",
    androgenic: "Low",
    cardiovascular: "Moderate",
    suppression: "Moderate",
  },
  alsoKnownAs: ["Anavar"],
}

function file(handle: string, content: unknown): ContentFileInput {
  return { handle, raw: JSON.stringify(content) }
}

function product(
  handle: string,
  metadata: Record<string, unknown> | null
): ProductInput {
  return { id: `prod_${handle}`, handle, metadata }
}

describe("planContentImport", () => {
  it("malformed JSON is invalid with a parse reason; nothing planned for writing", () => {
    const actions = planContentImport(
      [{ handle: "oxandrolone-zphc", raw: "{ not json" }],
      [product("oxandrolone-zphc", {})]
    )
    expect(actions).toHaveLength(1)
    expect(actions[0].status).toBe("invalid")
    expect((actions[0] as any).reason).toMatch(/Invalid JSON/)
    expect(actions.filter((a) => a.status !== "invalid")).toHaveLength(0)
  })

  it("schema violation is rejected naming the field; nothing planned for writing", () => {
    const { pct, ...dosageWithoutPct } = validCompound.dosage
    const bad = { ...validCompound, dosage: dosageWithoutPct }

    const actions = planContentImport(
      [file("oxandrolone-zphc", bad)],
      [product("oxandrolone-zphc", {})]
    )
    expect(actions[0].status).toBe("invalid")
    expect((actions[0] as any).reason).toContain("dosage.pct")
  })

  it("valid file on a product without content plans a created write", () => {
    const actions = planContentImport(
      [file("oxandrolone-zphc", validCompound)],
      [product("oxandrolone-zphc", { rank: 3 })]
    )
    expect(actions[0].status).toBe("created")
    expect((actions[0] as any).productId).toBe("prod_oxandrolone-zphc")
  })

  it("merged metadata preserves other keys (rank, template)", () => {
    const actions = planContentImport(
      [file("oxandrolone-zphc", validCompound)],
      [
        product("oxandrolone-zphc", {
          rank: 3,
          template: "compound",
          form: "Oral",
        }),
      ]
    )
    const merged = (actions[0] as any).mergedMetadata
    expect(merged.rank).toBe(3)
    expect(merged.template).toBe("compound")
    expect(merged.form).toBe("Oral")
    expect(merged.content).toEqual(validCompound)
  })

  it("existing different content plans an updated write", () => {
    const actions = planContentImport(
      [file("oxandrolone-zphc", validCompound)],
      [
        product("oxandrolone-zphc", {
          content: { ...validCompound, alsoKnownAs: ["Var"] },
        }),
      ]
    )
    expect(actions[0].status).toBe("updated")
  })

  it("idempotent: identical content plans no write and reports unchanged", () => {
    const actions = planContentImport(
      [file("oxandrolone-zphc", validCompound)],
      [product("oxandrolone-zphc", { rank: 3, content: validCompound })]
    )
    expect(actions).toEqual([
      { handle: "oxandrolone-zphc", status: "unchanged" },
    ])
  })

  it("unknown handle reports not_found", () => {
    const actions = planContentImport(
      [file("no-such-product", validCompound)],
      []
    )
    expect(actions[0].status).toBe("not_found")
    expect((actions[0] as any).reason).toContain("no-such-product")
  })
})

describe("parseArgs", () => {
  it("splits handles from the --dry-run flag (both spellings)", () => {
    expect(parseArgs(["oxandrolone-zphc", "--dry-run"])).toEqual({
      handles: ["oxandrolone-zphc"],
      dryRun: true,
    })
    expect(parseArgs(["dry-run", "a", "b"])).toEqual({
      handles: ["a", "b"],
      dryRun: true,
    })
    expect(parseArgs([])).toEqual({ handles: [], dryRun: false })
  })
})

describe("export → import round trip", () => {
  it("an exported file re-imports as unchanged", () => {
    const productMeta = { rank: 3, content: validCompound }

    const exportActions = planContentExport(
      [{ handle: "oxandrolone-zphc", metadata: productMeta }],
      new Map()
    )
    expect(exportActions[0].status).toBe("created")
    const fileBody = (exportActions[0] as any).fileBody

    const importActions = planContentImport(
      [{ handle: "oxandrolone-zphc", raw: fileBody }],
      [product("oxandrolone-zphc", productMeta)]
    )
    expect(importActions).toEqual([
      { handle: "oxandrolone-zphc", status: "unchanged" },
    ])
  })

  it("export is stable: same content, same file → unchanged", () => {
    const actions = planContentExport(
      [{ handle: "x", metadata: { content: validCompound } }],
      new Map([["x", serializeContentFile(validCompound as any)]])
    )
    expect(actions).toEqual([{ handle: "x", status: "unchanged" }])
  })

  it("export skips invalid legacy content with a loud reason", () => {
    const actions = planContentExport(
      [{ handle: "x", metadata: { content: { type: "compound" } } }],
      new Map()
    )
    expect(actions[0].status).toBe("skipped")
    expect((actions[0] as any).reason).toMatch(/invalid/i)
  })

  it("round-trips active_ingredient: export writes it top-level, import splits it back to flat metadata", () => {
    const productMeta = {
      rank: 3,
      active_ingredient: "Oxandrolone",
      content: validCompound,
    }

    const exportActions = planContentExport(
      [{ handle: "oxandrolone-zphc", metadata: productMeta }],
      new Map()
    )
    const fileBody = (exportActions[0] as any).fileBody
    // active_ingredient sits at the top level of the file, not inside content
    expect(JSON.parse(fileBody).active_ingredient).toBe("Oxandrolone")

    const importActions = planContentImport(
      [{ handle: "oxandrolone-zphc", raw: fileBody }],
      [product("oxandrolone-zphc", productMeta)]
    )
    expect(importActions).toEqual([
      { handle: "oxandrolone-zphc", status: "unchanged" },
    ])
  })
})

describe("active_ingredient in the file", () => {
  it("is split off into flat metadata, never into content", () => {
    const actions = planContentImport(
      [
        {
          handle: "oxandrolone-zphc",
          raw: JSON.stringify({
            active_ingredient: "Oxandrolone",
            ...validCompound,
          }),
        },
      ],
      [product("oxandrolone-zphc", { rank: 3 })]
    )
    expect(actions[0].status).toBe("created")
    const merged = (actions[0] as any).mergedMetadata
    expect(merged.active_ingredient).toBe("Oxandrolone")
    expect(merged.rank).toBe(3)
    expect("active_ingredient" in merged.content).toBe(false)
  })

  it("a blank/non-string active_ingredient is rejected naming the field", () => {
    const actions = planContentImport(
      [
        {
          handle: "x",
          raw: JSON.stringify({ active_ingredient: "  ", ...validCompound }),
        },
      ],
      [product("x", {})]
    )
    expect(actions[0].status).toBe("invalid")
    expect((actions[0] as any).reason).toContain("active_ingredient")
  })

  it("omitting active_ingredient from the file never clears an existing flat value", () => {
    const actions = planContentImport(
      [{ handle: "x", raw: JSON.stringify(validCompound) }],
      [product("x", { active_ingredient: "Oxandrolone", content: validCompound })]
    )
    expect(actions).toEqual([{ handle: "x", status: "unchanged" }])
  })

  it("changing only active_ingredient triggers an updated write", () => {
    const actions = planContentImport(
      [
        {
          handle: "x",
          raw: JSON.stringify({ active_ingredient: "Oxandrolone", ...validCompound }),
        },
      ],
      [product("x", { active_ingredient: "Old", content: validCompound })]
    )
    expect(actions[0].status).toBe("updated")
    expect((actions[0] as any).mergedMetadata.active_ingredient).toBe(
      "Oxandrolone"
    )
  })
})
