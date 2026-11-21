import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteCollectionsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Storefront Redesign Stage E — remove customer-visible US-domestic listings.
 *
 * The US-domestic supplier is gone (all products ship from one warehouse), so:
 * 1. Unpublish (status → draft) every product in the "US Domestic" collection —
 *    their titles carry "USA Domestic" and the goods cannot be fulfilled.
 *    Products are NOT deleted; republish from Admin if ever needed.
 * 2. Soft-delete the "US Domestic" collection itself.
 *
 * Deliberately NOT touched (ops decision 2026-07-21): the "US Domestic
 * [XT-Labs]" stock location, the Sheets sync jobs, and order history.
 *
 * Idempotent: already-draft products are skipped; a missing collection means
 * there is nothing left to do.
 *
 * Usage: npx medusa exec ./src/scripts/remove-us-domestic.ts [dry-run]
 * NOTE: the flag is the bare token `dry-run`, NOT `--dry-run` — medusa exec's
 * own CLI (yargs) intercepts `--options` before the script runs.
 */

const COLLECTION_TITLE = "US Domestic"

export default async function removeUsDomestic({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const dryRun = (args ?? []).some((a) => a === "--dry-run" || a === "dry-run")

  const { data: collections } = await query.graph({
    entity: "product_collection",
    filters: { title: COLLECTION_TITLE },
    fields: ["id", "title"],
  })

  if (collections.length === 0) {
    logger.info(
      `[remove-us-domestic] no "${COLLECTION_TITLE}" collection found — nothing to do`
    )
    return { unpublished: [], collectionDeleted: false, dryRun }
  }
  const collection = collections[0]

  const { data: products } = await query.graph({
    entity: "product",
    filters: { collection_id: collection.id },
    fields: ["id", "handle", "title", "status"],
  })

  const toUnpublish = products.filter(
    (p: { status: string }) => p.status === "published"
  )
  const alreadyDraft = products.length - toUnpublish.length

  if (!dryRun && toUnpublish.length > 0) {
    await updateProductsWorkflow(container).run({
      input: {
        products: toUnpublish.map((p: { id: string }) => ({
          id: p.id,
          status: "draft" as const,
        })),
      },
    })
  }
  for (const p of toUnpublish) {
    logger.info(`[remove-us-domestic] unpublish: ${p.handle} ("${p.title}")`)
  }

  if (!dryRun) {
    await deleteCollectionsWorkflow(container).run({
      input: { ids: [collection.id] },
    })
  }
  logger.info(
    `[remove-us-domestic] ${dryRun ? "would delete" : "deleted"} collection ` +
      `"${collection.title}" (${collection.id})`
  )

  logger.info(
    `[remove-us-domestic] ${dryRun ? "DRY RUN — nothing written. " : ""}` +
      `products_in_collection=${products.length} unpublished=${toUnpublish.length} ` +
      `already_draft=${alreadyDraft}`
  )

  return {
    unpublished: toUnpublish.map((p: { handle: string }) => p.handle),
    collectionDeleted: !dryRun,
    dryRun,
  }
}
