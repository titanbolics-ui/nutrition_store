import { MedusaContainer } from "@medusajs/framework"
import { MAGIC_TOKEN_MODULE } from "../modules/magic-token"

export default async function cleanupMagicTokens(container: MedusaContainer) {
  const magicTokenSvc = container.resolve(MAGIC_TOKEN_MODULE) as any
  const logger = container.resolve("logger")

  // Delete tokens expired more than 7 days ago
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const stale = await magicTokenSvc.listMagicTokens(
    { expires_at: { $lt: cutoff } },
    { select: ["id"] }
  )

  if (stale.length === 0) return

  await magicTokenSvc.deleteMagicTokens(stale.map((t: any) => t.id))
  logger.info(`[cleanup-magic-tokens] Deleted ${stale.length} expired tokens`)
}

export const config = {
  name: "cleanup-magic-tokens",
  schedule: "0 3 * * *", // 3am daily
}
