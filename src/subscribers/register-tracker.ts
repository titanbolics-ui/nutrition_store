import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa"
import { registerTrackerForFulfillment } from "../utils/easypost-tracker"

type ShipmentCreatedEvent = {
  id: string // fulfillment id
}

/**
 * On shipment.created, register an EasyPost tracker for the fulfillment's
 * tracking number (event-driven replacement for the old 17track polling cron).
 * Covers the sheets fresh-ship path and admin shipment labels. Already-shipped
 * paths that don't emit shipment.created call the helper directly.
 */
export default async function registerTrackerHandler({
  event,
  container,
}: SubscriberArgs<ShipmentCreatedEvent>) {
  const { id: fulfillmentId } = event.data
  if (!fulfillmentId) return
  await registerTrackerForFulfillment(container, fulfillmentId)
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
