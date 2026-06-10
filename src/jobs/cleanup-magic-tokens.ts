import { MedusaContainer } from "@medusajs/framework"
import { MAGIC_TOKEN_MODULE } from "../modules/magic-token"

export default async function cleanupMagicTokens(container: MedusaContainer) {
  const magicTokenSvc = container.resolve(MAGIC_TOKEN_MODULE) as any
  const logger = container.resolve("logger")

  const deleted = await magicTokenSvc.hardDeleteExpired()
  if (deleted > 0) {
    logger.info(`[cleanup-magic-tokens] Hard-deleted ${deleted} expired tokens`)
  }
}

export const config = {
  name: "cleanup-magic-tokens",
  schedule: "0 3 * * *",
}
