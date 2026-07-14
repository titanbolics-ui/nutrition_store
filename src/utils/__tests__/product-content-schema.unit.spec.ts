import { validateProductContent } from "../product-content-schema"

const validCompound = {
  type: "compound",
  overview: { what: "A testosterone ester.", howItWorks: "Binds androgen receptors." },
  dosage: {
    beginner: "300-500mg/week",
    intermediate: "500-750mg/week",
    advanced: "750-1000mg/week",
    cycleLength: "12-16 weeks",
    administration: "Intramuscular injection",
    pct: "Required",
  },
  profile: {
    anabolicRating: "100",
    androgenicRating: "100",
    ester: "Enanthate",
    halfLife: "4.5 days",
    aromatization: "Yes",
    detectionTime: "3 months",
  },
  sideEffects: {
    estrogenic: "Moderate",
    androgenic: "Moderate",
    cardiovascular: "Moderate",
    suppression: "High",
  },
}

const validPeptide = {
  type: "peptide",
  overview: { what: "A growth-hormone-releasing peptide.", mechanism: "Stimulates GHRH receptors." },
  keyHighlights: ["Supports recovery", "Well-tolerated"],
  research: { useCases: "Recovery, sleep quality", models: "Rodent models" },
}

describe("validateProductContent", () => {
  it("accepts a valid compound content object", () => {
    const result = validateProductContent(validCompound)
    expect(result.ok).toBe(true)
  })

  it("accepts a valid peptide content object", () => {
    const result = validateProductContent(validPeptide)
    expect(result.ok).toBe(true)
  })

  it("rejects a missing required field with a readable, field-named error", () => {
    const { dosage, ...rest } = validCompound
    const { beginner, ...dosageRest } = dosage
    const broken = { ...rest, dosage: dosageRest }

    const result = validateProductContent(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("dosage.beginner")
    }
  })

  it("rejects an unknown type literal", () => {
    const result = validateProductContent({ ...validCompound, type: "supplement" })
    expect(result.ok).toBe(false)
  })

  it("accepts each contentBlocks type in an array", () => {
    const withBlocks = {
      ...validPeptide,
      contentBlocks: [
        { type: "text", body: "Some text." },
        { type: "image", url: "https://example.com/diagram.png", caption: "Mechanism" },
        { type: "callout", body: "Important note." },
        { type: "table", headers: ["A", "B"], rows: [["1", "2"]] },
      ],
    }
    const result = validateProductContent(withBlocks)
    expect(result.ok).toBe(true)
  })

  it("accepts an optional title on text and callout blocks", () => {
    const withTitles = {
      ...validPeptide,
      contentBlocks: [
        { type: "text", title: "Why Choose It?", body: "Some text." },
        { type: "callout", title: "Note", body: "Important note." },
      ],
    }
    const result = validateProductContent(withTitles)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const blocks = result.content.contentBlocks
      expect(blocks?.[0]).toMatchObject({ type: "text", title: "Why Choose It?" })
      expect(blocks?.[1]).toMatchObject({ type: "callout", title: "Note" })
    }
  })

  it("still accepts text and callout blocks without a title (optional, not required)", () => {
    const withoutTitles = {
      ...validPeptide,
      contentBlocks: [
        { type: "text", body: "Some text." },
        { type: "callout", body: "Important note." },
      ],
    }
    const result = validateProductContent(withoutTitles)
    expect(result.ok).toBe(true)
  })

  it("rejects a malformed contentBlocks entry, naming the block field", () => {
    const withBadBlock = {
      ...validPeptide,
      contentBlocks: [{ type: "image", caption: "Missing url" }],
    }
    const result = validateProductContent(withBadBlock)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("contentBlocks")
      expect(result.error).toContain("url")
    }
  })

  it("rejects a contentBlocks entry missing/using the wrong field names (e.g. title/content instead of type/body) with a message that spells out the accepted types", () => {
    const withWrongShape = {
      ...validCompound,
      contentBlocks: [{ title: "Why Choose It?", content: "Some marketing text." }],
    }
    const result = validateProductContent(withWrongShape)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("contentBlocks.0.type")
      expect(result.error).toContain('"text"')
      expect(result.error).toContain('"image"')
      expect(result.error).toContain('"callout"')
      expect(result.error).toContain('"table"')
    }
  })

  it("rejects an unrecognized top-level type with a message that spells out the accepted values", () => {
    const result = validateProductContent({ ...validCompound, type: "supplement" })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('"compound"')
      expect(result.error).toContain('"peptide"')
    }
  })

  it("rejects a non-JSON string payload without throwing", () => {
    const result = validateProductContent("not an object")
    expect(result.ok).toBe(false)
  })

  it("accepts a valid compound content JSON-encoded as a string (the Admin dashboard path — its generic metadata table submits every value as a string) and returns the parsed object", () => {
    const result = validateProductContent(JSON.stringify(validCompound))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(typeof result.content).toBe("object")
      expect(result.content.type).toBe("compound")
    }
  })

  it("rejects a malformed JSON string (e.g. a truncated paste from the Admin metadata editor) with a readable 'Invalid JSON' error naming content", () => {
    const truncated = JSON.stringify(validCompound).slice(0, -5)
    const result = validateProductContent(truncated)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("content")
      expect(result.error).toContain("Invalid JSON")
    }
  })
})
