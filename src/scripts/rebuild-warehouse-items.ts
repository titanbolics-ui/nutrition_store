import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { rebuildOrderWarehouseItems } from "../utils/order-warehouse-items"

/**
 * Backfill order.metadata.warehouse_items for orders whose items changed
 * after checkout (order edits) before the order-edit-warehouse-meta
 * subscriber existed.
 *
 * Usage:
 *   npx medusa exec ./src/scripts/rebuild-warehouse-items.ts 1462 1463
 *   npx medusa exec ./src/scripts/rebuild-warehouse-items.ts        # all edited orders, last 60 days
 */
export default async function rebuildWarehouseItems({ container, args }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const displayIds = (args ?? []).map((a) => parseInt(String(a), 10)).filter((n) => !isNaN(n))

  let orderIds: { id: string; display_id: number }[] = []

  if (displayIds.length) {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "display_id"],
      filters: { display_id: displayIds as any },
    })
    orderIds = data as any[]
  } else {
    // all orders with a confirmed edit in the last 60 days
    const since = new Date()
    since.setDate(since.getDate() - 60)
    const { data: changes } = await query.graph({
      entity: "order_change",
      fields: ["order_id"],
      filters: { change_type: "edit", status: ["confirmed"] },
    })
    const ids = [...new Set((changes as any[]).map((c) => c.order_id))]
    if (ids.length) {
      const { data } = await query.graph({
        entity: "order",
        fields: ["id", "display_id", "created_at"],
        filters: { id: ids },
      })
      orderIds = (data as any[]).filter((o) => new Date(o.created_at) >= since)
    }
  }

  console.log(`Rebuilding warehouse_items for ${orderIds.length} order(s)...`)

  for (const o of orderIds) {
    try {
      const result = await rebuildOrderWarehouseItems(container, o.id)
      if (result) {
        const summary = Object.values(result)
          .map((w) => `${w.locationName}: ${w.items.map((i) => `${i.quantity}x ${i.title}`).join(", ")}`)
          .join(" | ")
        console.log(`✅ #${o.display_id}: ${summary}`)
      } else {
        console.log(`⏭️  #${o.display_id}: nothing to write`)
      }
    } catch (err: any) {
      console.error(`❌ #${o.display_id}: ${err?.message}`)
    }
  }
}
