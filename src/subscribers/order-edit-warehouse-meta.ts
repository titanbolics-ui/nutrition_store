import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { rebuildOrderWarehouseItems } from "../utils/order-warehouse-items"

/**
 * Order edits add/remove items but the warehouse_items snapshot in
 * order.metadata is only written at cart time — recompute it on every
 * confirmed edit so warehouse grouping (sheets sync, order pages) stays true.
 */
export default async function orderEditWarehouseMetaHandler({
  event: { data },
  container,
}: SubscriberArgs<{ order_id: string }>) {
  const logger = container.resolve("logger") as any
  try {
    const result = await rebuildOrderWarehouseItems(container, data.order_id)
    if (result) {
      logger.info(
        `[order-edit-warehouse-meta] Rebuilt warehouse_items for ${data.order_id}: ` +
          Object.values(result)
            .map((w) => `${w.locationName}(${w.items.length})`)
            .join(", ")
      )
    }
  } catch (err: any) {
    logger.warn(
      `[order-edit-warehouse-meta] Failed for ${data.order_id}: ${err?.message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order-edit.confirmed",
}
