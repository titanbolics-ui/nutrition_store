import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { validateProductContent } from "../utils/product-content-schema"
import {
  CONTENT_DIR,
  filenameFromHandle,
  serializeContentFile,
} from "../utils/content-files"
import { parseArgs } from "./import-content"

/**
 * Export existing metadata.content from products into content/<handle>.json —
 * bootstraps files for products that already have content and keeps the
 * committed folder in sync with the DB.
 *
 * - No args: every product whose metadata.content is set.
 * - With handles: only those products.
 * - Content is validated before writing: a file the importer would reject is
 *   never written — invalid legacy content is skipped with a loud reason.
 * - Canonical serialization (serializeContent) guarantees the round trip:
 *   export → import reports "unchanged".
 * - dry-run: report what would be written, write nothing.
 *
 * Usage: npx medusa exec ./src/scripts/export-content.ts [handle...] [dry-run]
 * NOTE: pass the flag as the bare token `dry-run`, NOT `--dry-run` — medusa
 * exec's own CLI (yargs) intercepts `--options` and errors before the script
 * runs, so only positional tokens reach args.
 */

export type ExportProductInput = {
  handle: string
  metadata: Record<string, unknown> | null
}

export type ExportAction =
  | { handle: string; status: "created" | "updated"; fileBody: string }
  | { handle: string; status: "unchanged" }
  | { handle: string; status: "skipped"; reason: string }

// Pure decision logic — unit-tested separately from file/DB access.
// existingFiles maps handle → current file body (only for files that exist).
export function planContentExport(
  products: ExportProductInput[],
  existingFiles: Map<string, string>
): ExportAction[] {
  const actions: ExportAction[] = []

  for (const product of products) {
    const content = product.metadata?.content
    if (content === undefined || content === null || content === "") {
      continue // nothing to export; not even worth a report line
    }

    const result = validateProductContent(content)
    if (!result.ok) {
      actions.push({
        handle: product.handle,
        status: "skipped",
        reason: `existing content is invalid, fix in DB or re-author: ${result.error}`,
      })
      continue
    }

    const activeIngredient =
      typeof product.metadata?.active_ingredient === "string" &&
      product.metadata.active_ingredient.trim().length > 0
        ? (product.metadata.active_ingredient as string)
        : undefined
    const fileBody = serializeContentFile(result.content, activeIngredient)
    const existing = existingFiles.get(product.handle)

    if (existing === fileBody) {
      actions.push({ handle: product.handle, status: "unchanged" })
    } else {
      actions.push({
        handle: product.handle,
        status: existing === undefined ? "created" : "updated",
        fileBody,
      })
    }
  }

  return actions
}

export default async function exportContent({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { handles, dryRun } = parseArgs(args ?? [])

  const { data: products } = await query.graph({
    entity: "product",
    ...(handles.length > 0 ? { filters: { handle: handles } } : {}),
    fields: ["id", "handle", "metadata"],
  })

  if (handles.length > 0) {
    const found = new Set(products.map((p: any) => p.handle))
    const missing = handles.filter((h) => !found.has(h))
    if (missing.length > 0) {
      logger.error(
        `[export-content] no product with handle: ${missing.join(", ")}`
      )
      process.exitCode = 1
      return
    }
  }

  const existingFiles = new Map<string, string>()
  for (const product of products as ExportProductInput[]) {
    const path = join(CONTENT_DIR, filenameFromHandle(product.handle))
    if (existsSync(path)) {
      existingFiles.set(product.handle, readFileSync(path, "utf-8"))
    }
  }

  const actions = planContentExport(
    products as ExportProductInput[],
    existingFiles
  )

  if (!dryRun) {
    mkdirSync(CONTENT_DIR, { recursive: true })
    for (const action of actions) {
      if (action.status === "created" || action.status === "updated") {
        writeFileSync(
          join(CONTENT_DIR, filenameFromHandle(action.handle)),
          action.fileBody
        )
      }
    }
  }

  for (const action of actions) {
    const suffix = "reason" in action ? ` — ${action.reason}` : ""
    const line = `[export-content] ${action.handle}: ${action.status}${suffix}`
    if (action.status === "skipped") {
      logger.error(line)
    } else {
      logger.info(line)
    }
  }

  const count = (s: ExportAction["status"]) =>
    actions.filter((a) => a.status === s).length
  logger.info(
    `[export-content] ${dryRun ? "DRY RUN — nothing written. " : ""}` +
      `products-with-content=${actions.length} created=${count("created")} ` +
      `updated=${count("updated")} unchanged=${count("unchanged")} ` +
      `skipped=${count("skipped")}`
  )

  if (count("skipped") > 0) {
    process.exitCode = 1
  }

  return { actions, dryRun }
}
