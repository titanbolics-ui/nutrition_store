import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductTypesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Storefront Redesign Stage E — assign the three in-house brands to products.
 *
 * Brand = Medusa product type (one per product, editable in Admin under
 * Product → Organize → Type, server-side filterable on the Store API via
 * type_id). This script:
 *
 * 1. Creates the three brand types if they don't exist yet.
 * 2. Auto-assigns a type to every product whose title/handle unambiguously
 *    names a brand (case-insensitive substring match).
 * 3. Reports every product it could NOT assign (no match, or matching more
 *    than one brand) — those are assigned manually in Admin, never guessed.
 *
 * Idempotent: a product that already has ANY type set is skipped, so manual
 * Admin assignments are never overwritten by a re-run.
 *
 * Usage: npx medusa exec ./src/scripts/assign-brands.ts [dry-run]
 * NOTE: the flag is the bare token `dry-run`, NOT `--dry-run` — medusa exec's
 * own CLI (yargs) intercepts `--options` before the script runs.
 */

export const BRANDS = [
  { value: "ZPHC", needle: "zphc" },
  { value: "Spectrum Pharma", needle: "spectrum" },
  { value: "CanadaBioLabs", needle: "canada" },
] as const

export type BrandValue = (typeof BRANDS)[number]["value"]

export type ProductInput = {
  id: string
  handle: string
  title: string
  type_id: string | null
}

export type AssignAction =
  | { handle: string; status: "assign"; productId: string; brand: BrandValue }
  | { handle: string; status: "already_typed" }
  | { handle: string; status: "unmatched" }
  | { handle: string; status: "ambiguous"; brands: BrandValue[] }

// Pure decision logic — unit-tested separately from DB access.
export function planBrandAssignment(products: ProductInput[]): AssignAction[] {
  return products.map((p): AssignAction => {
    if (p.type_id) {
      return { handle: p.handle, status: "already_typed" }
    }

    const haystack = `${p.title} ${p.handle}`.toLowerCase()
    const hits = BRANDS.filter((b) => haystack.includes(b.needle))

    if (hits.length === 0) {
      return { handle: p.handle, status: "unmatched" }
    }
    if (hits.length > 1) {
      return {
        handle: p.handle,
        status: "ambiguous",
        brands: hits.map((b) => b.value),
      }
    }
    return {
      handle: p.handle,
      status: "assign",
      productId: p.id,
      brand: hits[0].value,
    }
  })
}

export default async function assignBrands({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const dryRun = (args ?? []).some((a) => a === "--dry-run" || a === "dry-run")

  // 1. Ensure the three brand types exist.
  const { data: existingTypes } = await query.graph({
    entity: "product_type",
    fields: ["id", "value"],
  })
  const typeIdByValue = new Map<string, string>(
    existingTypes.map((t: { id: string; value: string }) => [t.value, t.id])
  )

  const missing = BRANDS.filter((b) => !typeIdByValue.has(b.value))
  if (missing.length > 0) {
    if (dryRun) {
      for (const b of missing) {
        logger.info(`[assign-brands] would create product type "${b.value}"`)
      }
    } else {
      const { result: created } = await createProductTypesWorkflow(
        container
      ).run({
        input: { product_types: missing.map((b) => ({ value: b.value })) },
      })
      for (const t of created) {
        typeIdByValue.set(t.value, t.id)
        logger.info(`[assign-brands] created product type "${t.value}" (${t.id})`)
      }
    }
  }

  // 2. Plan assignments across the whole catalog.
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "type_id"],
  })

  const actions = planBrandAssignment(products as ProductInput[])
  const assigns = actions.filter(
    (a): a is Extract<AssignAction, { status: "assign" }> =>
      a.status === "assign"
  )

  if (!dryRun && assigns.length > 0) {
    await updateProductsWorkflow(container).run({
      input: {
        products: assigns.map((a) => ({
          id: a.productId,
          type_id: typeIdByValue.get(a.brand)!,
        })),
      },
    })
  }

  // 3. Report.
  for (const a of assigns) {
    logger.info(`[assign-brands] ${a.handle}: → ${a.brand}`)
  }
  const unmatched = actions.filter((a) => a.status === "unmatched")
  for (const a of unmatched) {
    logger.warn(`[assign-brands] ${a.handle}: UNMATCHED — assign manually in Admin`)
  }
  const ambiguous = actions.filter(
    (a): a is Extract<AssignAction, { status: "ambiguous" }> =>
      a.status === "ambiguous"
  )
  for (const a of ambiguous) {
    logger.warn(
      `[assign-brands] ${a.handle}: AMBIGUOUS (${a.brands.join(
        ", "
      )}) — assign manually in Admin`
    )
  }

  const count = (s: AssignAction["status"]) =>
    actions.filter((a) => a.status === s).length
  const perBrand = BRANDS.map(
    (b) => `${b.value}=${assigns.filter((a) => a.brand === b.value).length}`
  ).join(" ")
  logger.info(
    `[assign-brands] ${dryRun ? "DRY RUN — nothing written. " : ""}` +
      `products=${actions.length} assigned=${count("assign")} (${perBrand}) ` +
      `already_typed=${count("already_typed")} unmatched=${count(
        "unmatched"
      )} ambiguous=${count("ambiguous")}`
  )

  // medusa exec ignores the return value; tests assert on it
  return { actions, dryRun }
}
