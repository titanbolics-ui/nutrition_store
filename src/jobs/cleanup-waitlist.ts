import { MedusaContainer } from "@medusajs/framework"
import { WAITLIST_MODULE } from "../modules/waitlist"

export default async function cleanupWaitlist(container: MedusaContainer) {
  const waitlistSvc = container.resolve(WAITLIST_MODULE) as any
  const logger = container.resolve("logger")

  const deleted = await waitlistSvc.hardDeleteStale()
  if (deleted > 0) {
    logger.info(`[cleanup-waitlist] Hard-deleted ${deleted} notified waitlist signups older than 90 days`)
  }
}

export const config = {
  name: "cleanup-waitlist",
  schedule: "0 3 * * *",
}
