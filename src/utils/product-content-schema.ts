import { z } from "zod"

const faqEntrySchema = z.object({
  q: z.string().min(1),
  a: z.string().min(1),
})

const CONTENT_BLOCK_TYPES = ["text", "image", "callout", "table"] as const

const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    title: z.string().optional(),
    body: z.string().min(1),
  }),
  z.object({
    type: z.literal("image"),
    url: z.string().url(),
    caption: z.string().optional(),
  }),
  z.object({
    type: z.literal("callout"),
    title: z.string().optional(),
    body: z.string().min(1),
  }),
  z.object({
    type: z.literal("table"),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
])

const sharedContentFields = {
  coaUrl: z.string().url().optional(),
  faq: z.array(faqEntrySchema).optional(),
  contentBlocks: z.array(contentBlockSchema).optional(),
  alsoKnownAs: z.array(z.string()).optional(),
}

const compoundContentSchema = z.object({
  type: z.literal("compound"),
  overview: z.object({
    what: z.string().min(1),
    howItWorks: z.string().min(1),
  }),
  dosage: z.object({
    beginner: z.string().min(1),
    intermediate: z.string().min(1),
    advanced: z.string().min(1),
    cycleLength: z.string().min(1),
    administration: z.string().min(1),
    pct: z.string().min(1),
  }),
  profile: z.object({
    anabolicRating: z.string().min(1),
    androgenicRating: z.string().min(1),
    ester: z.string().min(1),
    halfLife: z.string().min(1),
    aromatization: z.string().min(1),
    detectionTime: z.string().min(1),
  }),
  sideEffects: z.object({
    estrogenic: z.string().min(1),
    androgenic: z.string().min(1),
    cardiovascular: z.string().min(1),
    suppression: z.string().min(1),
  }),
  ...sharedContentFields,
})

const peptideContentSchema = z.object({
  type: z.literal("peptide"),
  overview: z.object({
    what: z.string().min(1),
    mechanism: z.string().min(1),
  }),
  keyHighlights: z.array(z.string().min(1)).min(1),
  research: z.object({
    useCases: z.string().min(1),
    models: z.string().min(1),
  }),
  stacking: z
    .array(
      z.object({
        productHandle: z.string().min(1),
        label: z.string().min(1),
      })
    )
    .optional(),
  ...sharedContentFields,
})

const TOP_LEVEL_CONTENT_TYPES = ["compound", "peptide"] as const

export const productContentSchema = z.discriminatedUnion("type", [
  compoundContentSchema,
  peptideContentSchema,
])

export type ProductContent = z.infer<typeof productContentSchema>

export type ValidateProductContentResult =
  | { ok: true; content: ProductContent }
  | { ok: false; error: string }

/**
 * A typo in metadata.content must never silently corrupt a page — reject with
 * a single readable, field-named error (first zod issue) rather than the full
 * error tree. Caller decides what "absent" means; this only validates when
 * content is actually present.
 *
 * Accepts either an already-parsed object (the programmatic/API path) or a
 * JSON-encoded string (the Admin dashboard path — its generic metadata table
 * edits every key as a plain string, so content arrives as a string there,
 * not an object). A string that isn't valid JSON is rejected the same way a
 * malformed shape is: readable, field-named, never silently swallowed.
 */
export function validateProductContent(
  raw: unknown
): ValidateProductContentResult {
  let candidate: unknown = raw

  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw)
    } catch (e) {
      const message = e instanceof Error ? e.message : "malformed JSON"
      return { ok: false, error: `Invalid metadata.content: content — Invalid JSON: ${message}` }
    }
  }

  const parsed = productContentSchema.safeParse(candidate)
  if (parsed.success) {
    return { ok: true, content: parsed.data }
  }

  const issue = parsed.error.issues[0]
  const path = issue.path.join(".") || "content"

  // zod's default message for a missing/unrecognized discriminator on a
  // discriminatedUnion is a bare "Invalid input" — useless on its own, so
  // spell out the accepted values instead of making the author guess.
  if (issue.code === "invalid_union") {
    if (issue.path[issue.path.length - 1] === "type" && issue.path.includes("contentBlocks")) {
      return {
        ok: false,
        error:
          `Invalid metadata.content: ${path} — missing or unrecognized block type. ` +
          `Each contentBlocks entry needs "type" set to one of: ` +
          `${CONTENT_BLOCK_TYPES.map((t) => `"${t}"`).join(", ")}.`,
      }
    }
    if (path === "type") {
      return {
        ok: false,
        error:
          `Invalid metadata.content: type — missing or unrecognized content type. ` +
          `metadata.content needs "type" set to one of: ` +
          `${TOP_LEVEL_CONTENT_TYPES.map((t) => `"${t}"`).join(", ")}.`,
      }
    }
  }

  return { ok: false, error: `Invalid metadata.content: ${path} — ${issue.message}` }
}
