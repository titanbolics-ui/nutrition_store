import { existsSync, readdirSync, readFileSync } from "fs"
import { join } from "path"
import { isDeepStrictEqual } from "util"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import {
  validateProductContent,
  ProductContent,
} from "../utils/product-content-schema"
import {
  CONTENT_DIR,
  filenameFromHandle,
  handleFromFilename,
} from "../utils/content-files"

/**
 * Import product copy from content/<handle>.json into metadata.content.
 *
 * Medusa Admin's metadata table only stores primitives, so the nested
 * content object cannot be edited there — the content/ directory is the
 * source of truth and this script is the only supported write path.
 *
 * - No args: process every content/*.json.
 * - With handles: only those files (a requested handle with no file fails).
 * - Every file is validated against the same zod schema the Admin API
 *   enforces (validateProductContent) BEFORE anything is written; an invalid
 *   file is reported with its field path and never persisted. Valid files in
 *   the same run still import.
 * - Idempotent: unchanged content plans no write and reports "unchanged".
 * - Metadata is merged explicitly ({...existing, content}) so keys like
 *   rank/template survive regardless of Medusa's own merge semantics.
 * - dry-run: validate + report what would change, write nothing.
 *
 * Usage: npx medusa exec ./src/scripts/import-content.ts [handle...] [dry-run]
 * NOTE: pass the flag as the bare token `dry-run`, NOT `--dry-run` — medusa
 * exec's own CLI (yargs) intercepts `--options` and errors before the script
 * runs, so only positional tokens reach args.
 */

export type ContentFileInput = { handle: string; raw: string }
export type ProductInput = {
  id: string
  handle: string
  metadata: Record<string, unknown> | null
}

export type ImportAction =
  | {
      handle: string
      status: "created" | "updated"
      productId: string
      mergedMetadata: Record<string, unknown>
    }
  | { handle: string; status: "unchanged" }
  | { handle: string; status: "invalid" | "not_found"; reason: string }

// Pure decision logic — unit-tested separately from file/DB access.
export function planContentImport(
  files: ContentFileInput[],
  products: ProductInput[]
): ImportAction[] {
  const byHandle = new Map(products.map((p) => [p.handle, p]))

  return files.map((file): ImportAction => {
    let parsed: unknown
    try {
      parsed = JSON.parse(file.raw)
    } catch (e) {
      const message = e instanceof Error ? e.message : "malformed JSON"
      return {
        handle: file.handle,
        status: "invalid",
        reason: `Invalid JSON: ${message}`,
      }
    }

    // active_ingredient lives at the top level of the file for authoring
    // convenience but is a flat metadata key, NOT part of content — split it
    // off before validating (the content schema would silently strip it).
    let activeIngredient: string | undefined
    let contentPart: unknown = parsed
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const { active_ingredient, ...rest } = parsed as Record<string, unknown>
      contentPart = rest
      if (active_ingredient !== undefined) {
        if (
          typeof active_ingredient !== "string" ||
          active_ingredient.trim().length === 0
        ) {
          return {
            handle: file.handle,
            status: "invalid",
            reason:
              "active_ingredient — must be a non-empty string when present",
          }
        }
        activeIngredient = active_ingredient
      }
    }

    const result = validateProductContent(contentPart)
    if (!result.ok) {
      return { handle: file.handle, status: "invalid", reason: result.error }
    }

    const product = byHandle.get(file.handle)
    if (!product) {
      return {
        handle: file.handle,
        status: "not_found",
        reason: `no product with handle "${file.handle}"`,
      }
    }

    const existingMetadata = product.metadata ?? {}
    const existingContent = existingMetadata.content
    const existingActiveIngredient = existingMetadata.active_ingredient

    const contentSame = isDeepStrictEqual(existingContent, result.content)
    // Only compares when the file carries active_ingredient — omitting it from
    // the file never rewrites/clears an existing flat value.
    const activeIngredientSame =
      activeIngredient === undefined ||
      existingActiveIngredient === activeIngredient

    if (contentSame && activeIngredientSame) {
      return { handle: file.handle, status: "unchanged" }
    }

    return {
      handle: file.handle,
      status: existingContent === undefined ? "created" : "updated",
      productId: product.id,
      mergedMetadata: {
        ...existingMetadata,
        content: result.content,
        ...(activeIngredient ? { active_ingredient: activeIngredient } : {}),
      },
    }
  })
}

export function parseArgs(args: string[]): {
  handles: string[]
  dryRun: boolean
} {
  // The bare "dry-run" token is the one that actually reaches us (medusa
  // exec's yargs rejects "--dry-run" before the script runs); "--dry-run" is
  // accepted too, harmlessly, in case that CLI behavior ever changes.
  const dryRun = args.some((a) => a === "--dry-run" || a === "dry-run")
  const handles = args.filter((a) => a !== "--dry-run" && a !== "dry-run")
  return { handles, dryRun }
}

export default async function importContent({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { handles, dryRun } = parseArgs(args ?? [])

  if (!existsSync(CONTENT_DIR)) {
    logger.error(`[import-content] content directory not found: ${CONTENT_DIR}`)
    process.exitCode = 1
    return
  }

  // Resolve which files to process
  let filenames: string[]
  if (handles.length > 0) {
    filenames = handles.map(filenameFromHandle)
    const missing = filenames.filter(
      (f) => !existsSync(join(CONTENT_DIR, f))
    )
    if (missing.length > 0) {
      logger.error(
        `[import-content] no content file for: ${missing
          .map(handleFromFilename)
          .join(", ")} (expected ${missing
          .map((f) => `content/${f}`)
          .join(", ")})`
      )
      process.exitCode = 1
      return
    }
  } else {
    filenames = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json"))
    if (filenames.length === 0) {
      logger.warn(`[import-content] no *.json files in ${CONTENT_DIR}`)
      return
    }
  }

  const files: ContentFileInput[] = filenames.map((f) => ({
    handle: handleFromFilename(f),
    raw: readFileSync(join(CONTENT_DIR, f), "utf-8"),
  }))

  const { data: products } = await query.graph({
    entity: "product",
    filters: { handle: files.map((f) => f.handle) },
    fields: ["id", "handle", "metadata"],
  })

  const actions = planContentImport(files, products as ProductInput[])

  const writes = actions.filter(
    (a): a is Extract<ImportAction, { status: "created" | "updated" }> =>
      a.status === "created" || a.status === "updated"
  )
  const failures = actions.filter(
    (a) => a.status === "invalid" || a.status === "not_found"
  )

  if (!dryRun && writes.length > 0) {
    await updateProductsWorkflow(container).run({
      input: {
        products: writes.map((w) => ({
          id: w.productId,
          metadata: w.mergedMetadata,
        })),
      },
    })
  }

  for (const action of actions) {
    const suffix = "reason" in action ? ` — ${action.reason}` : ""
    const line = `[import-content] ${action.handle}: ${action.status}${suffix}`
    if (action.status === "invalid" || action.status === "not_found") {
      logger.error(line)
    } else {
      logger.info(line)
    }
  }

  const count = (s: ImportAction["status"]) =>
    actions.filter((a) => a.status === s).length
  logger.info(
    `[import-content] ${dryRun ? "DRY RUN — nothing written. " : ""}` +
      `files=${actions.length} created=${count("created")} ` +
      `updated=${count("updated")} unchanged=${count("unchanged")} ` +
      `invalid=${count("invalid")} not_found=${count("not_found")}`
  )

  if (failures.length > 0) {
    process.exitCode = 1
  }

  // medusa exec ignores the return value; integration tests assert on it
  return { actions, dryRun }
}
