import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * One-off cleanup after migrating delivery tracking 17track → EasyPost.
 *
 * The seventeen-track module is gone, so its migrations can no longer run to
 * drop the orphaned table. This drops it directly. Idempotent (IF EXISTS) —
 * safe to run more than once, no-op once the table is gone.
 *
 * Run manually post-merge:
 *   npx medusa exec ./src/scripts/drop-seventeen-track-table.ts
 */
export default async function dropSeventeenTrackTable({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

  await knex.raw('DROP TABLE IF EXISTS "seventeen_track_number" CASCADE')
  logger.info("[cleanup] dropped table seventeen_track_number (if it existed)")
}
